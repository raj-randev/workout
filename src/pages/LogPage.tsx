import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { DAYS } from '../data/days';
import { importWorkbook } from '../import';
import { addCustomExercise, createSessionDraft, deleteSession, findSession, loadAppData, loadAppDataAsync, removeCustomExercise, saveAppData } from '../storage';
import type { AppData, DayName, Session, SetEntry } from '../types';

const dayNames: DayName[] = ['Lower A', 'Upper A', 'Lower B', 'Upper B'];

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function compareSessionDate(a: Session, b: Session) {
  return a.date.localeCompare(b.date);
}

function mergeImportedSessions(existing: AppData, imported: Session[]) {
  const mergedSessions = [...existing.sessions];

  imported.forEach((incoming) => {
    const existingIndex = mergedSessions.findIndex((session) => session.date === incoming.date && session.day === incoming.day);
    if (existingIndex === -1) {
      mergedSessions.push(incoming);
      return;
    }

    const target = mergedSessions[existingIndex];
    incoming.entries.forEach((entry) => {
      const existingEntry = target.entries.find((item) => item.exercise === entry.exercise);
      if (existingEntry) {
        existingEntry.sets.push(...entry.sets);
      } else {
        target.entries.push(entry);
      }
    });
  });

  return {
    ...existing,
    sessions: mergedSessions.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function getLastSessionForExercise(exercise: string, day: DayName, date: string, data: AppData) {
  const sessions = data.sessions
    .filter((session) => session.day === day && session.date < date)
    .sort((a, b) => compareSessionDate(b, a));

  const last = sessions[0];
  if (!last) return null;
  const entry = last.entries.find((item) => item.exercise === exercise);
  if (!entry) return null;

  const set = entry.sets[0];
  return `${set.w}kg × ${set.r}${set.e !== null ? ` @ ${set.e}` : ''}`;
}

function formatSessionForClaude(session: Session) {
  const lines = [`Date: ${session.date}`, `Day: ${session.day}`];
  session.entries.forEach((entry) => {
    const row = entry.sets
      .map((set) => {
        if (!set.w && !set.r && set.e === null) {
          return null;
        }
        const effort = set.e !== null ? `@${set.e}` : '';
        return `${set.w}×${set.r}${effort}`;
      })
      .filter(Boolean)
      .join(', ');

    lines.push(`${entry.exercise}: ${row || 'no data'}
`);
  });
  return lines.join('\n');
}

export function LogPage() {
  const [selectedDay, setSelectedDay] = useState<DayName>('Lower A');
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [appData, setAppData] = useState<AppData>({ sessions: [], custom: [] });
  const [draftSession, setDraftSession] = useState<Session | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', day: 'Lower A' as DayName, sets: 3, reps: '10–12' });
  const [customError, setCustomError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAppDataAsync().then(({ data }) => setAppData(data));
  }, []);

  useEffect(() => {
    const stored = findSession(selectedDate, selectedDay, appData);
    if (stored) {
      setDraftSession(stored);
      return;
    }
    setDraftSession(createSessionDraft(selectedDate, selectedDay, appData.custom));
  }, [selectedDate, selectedDay, appData]);

  const customForSelectedDay = useMemo(
    () => appData.custom.filter((exercise) => exercise.day === selectedDay),
    [appData.custom, selectedDay],
  );

  const currentSession = findSession(selectedDate, selectedDay, appData);
  const editingSavedSession = Boolean(currentSession);

  function updateEntry(exercise: string, setIndex: number, key: keyof SetEntry, value: string) {
    setDraftSession((previous) => {
      if (!previous) return previous;
      const entries = previous.entries.map((entry) => {
        if (entry.exercise !== exercise) return entry;
        const sets = entry.sets.map((set, index) => {
          if (index !== setIndex) return set;
          const parsed = key === 'e' ? (value === '' ? null : Number(value)) : Number(value);
          return {
            ...set,
            [key]: Number.isNaN(parsed) ? (key === 'e' ? null : 0) : parsed,
          };
        });
        return { ...entry, sets };
      });
      return { ...previous, entries };
    });
  }

  function persistSession() {
    if (!draftSession) return;
    const updatedSessions = appData.sessions.filter(
      (session) => !(session.date === selectedDate && session.day === selectedDay),
    );

    const nextData: AppData = {
      ...appData,
      sessions: [...updatedSessions, draftSession].sort((a, b) => a.date.localeCompare(b.date)),
    };
    setAppData(nextData);
    saveAppData(nextData);
  }

  function removeSession() {
    const nextData = deleteSession(selectedDate, selectedDay, appData);
    setAppData(nextData);
    saveAppData(nextData);
    setDraftSession(createSessionDraft(selectedDate, selectedDay, appData.custom));
  }

  function showCustomModal() {
    setCustomError(null);
    setCustomForm({ name: '', day: selectedDay, sets: 3, reps: '10–12' });
    setIsCustomModalOpen(true);
  }

  function submitCustomExercise() {
    const trimmed = customForm.name.trim();
    if (!trimmed) {
      setCustomError('Exercise name is required.');
      return;
    }

    if (customForm.sets < 1 || customForm.sets > 6) {
      setCustomError('Sets must be between 1 and 6.');
      return;
    }

    const duplicate = appData.custom.some(
      (item) => item.day === customForm.day && item.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setCustomError('A custom exercise with that name already exists for this day.');
      return;
    }

    const nextData = addCustomExercise(
      { name: trimmed, day: customForm.day, sets: customForm.sets, reps: customForm.reps },
      appData,
    );
    setAppData(nextData);
    saveAppData(nextData);
    setIsCustomModalOpen(false);
  }

  function deleteCustomExercise(name: string, day: DayName) {
    const nextData = removeCustomExercise(name, day, appData);
    setAppData(nextData);
    saveAppData(nextData);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportMessage('Importing spreadsheet…');

    try {
      const importedSessions = await importWorkbook(file);
      if (!importedSessions.length) {
        setImportError('No workout rows were found in that file.');
        return;
      }

      const nextData = mergeImportedSessions(appData, importedSessions);
      setAppData(nextData);
      saveAppData(nextData);
      setImportMessage(`Imported ${importedSessions.length} session(s).`);
      setSelectedDate(importedSessions[0].date);
      setSelectedDay(importedSessions[0].day);
      setIsImportModalOpen(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'That spreadsheet could not be imported.');
    }
  }

  function copyForClaude() {
    if (!draftSession) return;
    const priorSession = appData.sessions
      .filter((session) => session.day === selectedDay && session.date < selectedDate)
      .sort((a, b) => compareSessionDate(b, a))[0];

    const lines = ['Latest session summary:', formatSessionForClaude(draftSession)];
    if (priorSession) {
      lines.push('', 'Previous same-day session:', formatSessionForClaude(priorSession));
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess('Copied to clipboard');
      window.setTimeout(() => setCopySuccess(null), 3000);
    });
  }

  if (!draftSession) {
    return <div className="section-card">Loading log editor…</div>;
  }

  const sessionCount = draftSession.entries.length;
  const copyText = (() => {
    const priorSession = appData.sessions
      .filter((session) => session.day === selectedDay && session.date < selectedDate)
      .sort((a, b) => compareSessionDate(b, a))[0];
    const lines = ['Latest session summary:', formatSessionForClaude(draftSession)];
    if (priorSession) {
      lines.push('', 'Previous same-day session:', formatSessionForClaude(priorSession));
    }
    return lines.join('\n');
  })();

  return (
    <section className="section-card">
      <header>
        <div>
          <p className="eyebrow">Workout log</p>
          <h2>Log session</h2>
        </div>
      </header>

      <div className="day-pills">
        {dayNames.map((day) => (
          <button
            key={day}
            type="button"
            className={`day-pill ${day === selectedDay ? 'active' : ''}`}
            onClick={() => setSelectedDay(day)}
          >
            {day}
          </button>
        ))}
      </div>
      <div className="date-field">
        <label htmlFor="session-date">Session date</label>
        <input id="session-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
      </div>

      <div className="controls-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="button-primary" onClick={showCustomModal}>
            Add custom exercise
          </button>
          <button type="button" className="button-pill" onClick={() => { setImportError(null); setImportMessage(null); setIsImportModalOpen(true); }}>
            Import spreadsheet
          </button>
        </div>
        {editingSavedSession && (
          <button type="button" className="button-pill" onClick={removeSession}>
            Delete session
          </button>
        )}
      </div>

      {customForSelectedDay.length > 0 && (
        <div className="section-card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Custom exercises for {selectedDay}</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {customForSelectedDay.map((exercise) => (
              <div key={exercise.name} className="badge custom" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {exercise.name}
                <button
                  type="button"
                  style={{ border: 'none', background: 'transparent', color: '#1f2530', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => deleteCustomExercise(exercise.name, selectedDay)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingSavedSession && (
        <div style={{ marginBottom: '18px', color: '#4c63b6' }}>
          Editing saved session for {selectedDay} on {selectedDate}.
        </div>
      )}

      <div className="exercise-grid">
        {draftSession.entries.map((entry) => (
          <article className="exercise-card" key={entry.exercise}>
            <header>
              <div>
                <h3>{entry.exercise}</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <span className="badge">{entry.sets.length} sets</span>
                  <span className={`badge ${selectedDay.startsWith('Upper') ? 'day-upper' : 'day-lower'}`}>
                    {selectedDay.startsWith('Upper') ? 'Upper' : 'Lower'} day
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.92rem', color: '#6a7180' }}>
                Last: {getLastSessionForExercise(entry.exercise, selectedDay, selectedDate, appData) ?? 'none'}
              </div>
            </header>
            <div className="card-body">
              {entry.sets.map((set, index) => (
                <div className="set-row" key={`${entry.exercise}-${index}`}>
                  <label>
                    Weight
                    <input
                      type="number"
                      min="0"
                      value={set.w}
                      onChange={(event) => updateEntry(entry.exercise, index, 'w', event.target.value)}
                    />
                  </label>
                  <label>
                    Reps
                    <input
                      type="number"
                      min="0"
                      value={set.r}
                      onChange={(event) => updateEntry(entry.exercise, index, 'r', event.target.value)}
                    />
                  </label>
                  <label>
                    Effort
                    <input
                      type="number"
                      min="0"
                      value={set.e ?? ''}
                      onChange={(event) => updateEntry(entry.exercise, index, 'e', event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginTop: '22px' }}>
        <div>{sessionCount} exercise{sessionCount === 1 ? '' : 's'} ready to save.</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="button-primary" type="button" onClick={persistSession}>
            {editingSavedSession ? 'Update session' : 'Save session'}
          </button>
          <button className="button-pill" type="button" onClick={copyForClaude}>
            Copy for Claude
          </button>
        </div>
      </div>

      {copySuccess && <div style={{ color: 'var(--ok)', marginTop: '12px' }}>{copySuccess}</div>}

      <div style={{ marginTop: '24px' }}>
        <label>
          Session export preview
          <textarea readOnly value={copyText} rows={8} style={{ width: '100%', marginTop: '8px', borderRadius: '14px', border: '1px solid rgba(31,37,48,0.18)', padding: '14px', resize: 'vertical' }} />
        </label>
      </div>

      {isCustomModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel">
            <h3>Add custom exercise</h3>
            <div className="field-grid">
              <label>
                Name
                <input
                  type="text"
                  value={customForm.name}
                  onChange={(event) => setCustomForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label>
                Day
                <select
                  value={customForm.day}
                  onChange={(event) => setCustomForm((prev) => ({ ...prev, day: event.target.value as DayName }))}
                >
                  {dayNames.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sets
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={customForm.sets}
                  onChange={(event) => setCustomForm((prev) => ({ ...prev, sets: Number(event.target.value) }))}
                />
              </label>
              <label>
                Rep range
                <input
                  type="text"
                  value={customForm.reps}
                  onChange={(event) => setCustomForm((prev) => ({ ...prev, reps: event.target.value }))}
                />
              </label>
            </div>
            {customError && <div className="small-text" style={{ color: 'var(--avoid)' }}>{customError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '18px' }}>
              <button type="button" className="button-pill" onClick={() => setIsCustomModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="button-primary" onClick={submitCustomExercise}>
                Save exercise
              </button>
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel">
            <h3>Import spreadsheet</h3>
            <p className="login-copy">Upload an .xlsx, .xls, or .csv file. The importer looks for date, day, exercise, weight, reps, and effort columns.</p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} />
            {importError && <div className="small-text" style={{ color: 'var(--avoid)' }}>{importError}</div>}
            {importMessage && <div className="small-text" style={{ color: 'var(--ok)' }}>{importMessage}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '18px' }}>
              <button type="button" className="button-pill" onClick={() => setIsImportModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
