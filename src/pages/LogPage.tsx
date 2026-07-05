import { useEffect, useState } from 'react';
import { addCustomExercise, createSessionDraft, deleteSession, findSession, loadAppDataAsync, removeCustomExercise, saveAppData } from '../storage';
import type { AppData, DayName, Session, SetEntry } from '../types';

const dayNames: DayName[] = ['Lower A', 'Upper A', 'Lower B', 'Upper B'];

function compareSessionDate(a: Session, b: Session) {
  return a.date.localeCompare(b.date);
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
        if (!set.w && !set.r && set.e === null) return null;
        const effort = set.e !== null ? `@${set.e}` : '';
        return `${set.w}×${set.r}${effort}`;
      })
      .filter(Boolean)
      .join(', ');
    lines.push(`${entry.exercise}: ${row || 'no data'}`);
  });
  return lines.join('\n');
}

export function LogPage() {
  const [selectedDay, setSelectedDay] = useState<DayName | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [appData, setAppData] = useState<AppData>({ sessions: [], custom: [] });
  const [draftSession, setDraftSession] = useState<Session | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', day: 'Lower A' as DayName, sets: 3, reps: '10–12' });
  const [customError, setCustomError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadAppDataAsync().then(({ data }) => setAppData(data));
  }, []);

  useEffect(() => {
    if (!selectedDate || !selectedDay) {
      setDraftSession(null);
      return;
    }
    const stored = findSession(selectedDate, selectedDay, appData);
    setDraftSession(stored ?? createSessionDraft(selectedDate, selectedDay, appData.custom));
  }, [selectedDate, selectedDay, appData]);

  const currentSession = selectedDate && selectedDay
    ? (findSession(selectedDate, selectedDay, appData) ?? null)
    : null;
  const isLocked = currentSession !== null;

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedDay(null);
  }

  function handleDaySelect(day: DayName) {
    if (selectedDay === day) {
      if (!isLocked) setSelectedDay(null);
    } else if (selectedDay === null) {
      setSelectedDay(day);
    }
  }

  function updateEntry(exercise: string, setIndex: number, key: keyof SetEntry, value: string) {
    if (isLocked) return;
    setDraftSession((prev) => {
      if (!prev) return prev;
      const entries = prev.entries.map((entry) => {
        if (entry.exercise !== exercise) return entry;
        const sets = entry.sets.map((set, i) => {
          if (i !== setIndex) return set;
          const parsed = key === 'e' ? (value === '' ? null : Number(value)) : Number(value);
          return { ...set, [key]: Number.isNaN(parsed) ? (key === 'e' ? null : 0) : parsed };
        });
        return { ...entry, sets };
      });
      return { ...prev, entries };
    });
  }

  function persistSession() {
    if (!draftSession || !selectedDay) return;
    const filtered = appData.sessions.filter(
      (s) => !(s.date === selectedDate && s.day === selectedDay),
    );
    const nextData: AppData = {
      ...appData,
      sessions: [...filtered, draftSession].sort((a, b) => a.date.localeCompare(b.date)),
    };
    setAppData(nextData);
    saveAppData(nextData);
  }

  function removeSession() {
    if (!selectedDay) return;
    const nextData = deleteSession(selectedDate, selectedDay, appData);
    setAppData(nextData);
    saveAppData(nextData);
    setDraftSession(createSessionDraft(selectedDate, selectedDay, nextData.custom));
  }

  function submitCustomExercise() {
    const trimmed = customForm.name.trim();
    if (!trimmed) { setCustomError('Exercise name is required.'); return; }
    if (customForm.sets < 1 || customForm.sets > 6) { setCustomError('Sets must be between 1 and 6.'); return; }
    const duplicate = appData.custom.some(
      (item) => item.day === customForm.day && item.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) { setCustomError('A custom exercise with that name already exists for this day.'); return; }
    const nextData = addCustomExercise(
      { name: trimmed, day: customForm.day, sets: customForm.sets, reps: customForm.reps },
      appData,
    );
    setAppData(nextData);
    saveAppData(nextData);
    setIsCustomModalOpen(false);
  }

  function handleDeleteCustomExercise(name: string, day: DayName) {
    const nextData = removeCustomExercise(name, day, appData);
    setAppData(nextData);
    saveAppData(nextData);
  }

  function copyForClaude() {
    if (!draftSession || !selectedDay) return;
    const prior = appData.sessions
      .filter((s) => s.day === selectedDay && s.date < selectedDate)
      .sort((a, b) => compareSessionDate(b, a))[0];
    const lines = ['Latest session summary:', formatSessionForClaude(draftSession)];
    if (prior) lines.push('', 'Previous same-day session:', formatSessionForClaude(prior));
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopySuccess('Copied!');
      window.setTimeout(() => setCopySuccess(null), 3000);
    });
  }

  function openCustomModal() {
    setCustomError(null);
    setCustomForm({ name: '', day: selectedDay ?? 'Lower A', sets: 3, reps: '10–12' });
    setIsCustomModalOpen(true);
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* ── Log session ─────────────────────────────── */}
      <section className="section-card">
        <p className="eyebrow">Workout log</p>
        <h2 style={{ marginTop: 0, marginBottom: '18px' }}>Log session</h2>

        {/* Date — blank on load, always shown */}
        <div className="date-field">
          <label htmlFor="session-date">Session date</label>
          <input
            id="session-date"
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        {!selectedDate && (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '4px 0 0' }}>
            Select a date to begin logging.
          </p>
        )}

        {/* Day pills — appear once date is selected */}
        {selectedDate && (
          <div className="day-pills">
            {dayNames.map((day) => (
              <button
                key={day}
                type="button"
                className={`day-pill ${day === selectedDay ? 'active' : ''}`}
                disabled={selectedDay !== null && day !== selectedDay}
                onClick={() => handleDaySelect(day)}
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {/* Exercise grid — appears once day is selected */}
        {selectedDate && selectedDay && draftSession && (
          <>
            {isLocked && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '10px 14px',
                marginBottom: '14px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Session saved — read only
                </span>
                <button
                  type="button"
                  className="button-pill"
                  style={{ color: 'var(--avoid)', borderColor: 'rgba(239,83,80,0.3)', minHeight: '40px', padding: '8px 16px', fontSize: '0.9rem' }}
                  onClick={removeSession}
                >
                  Delete session
                </button>
              </div>
            )}

            <div className="exercise-grid">
              {draftSession.entries.map((entry) => (
                <article className="exercise-card" key={entry.exercise}>
                  <header>
                    <div>
                      <h3>{entry.exercise}</h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span className="badge">{entry.sets.length} sets</span>
                        <span className={`badge ${selectedDay.startsWith('Upper') ? 'day-upper' : 'day-lower'}`}>
                          {selectedDay.startsWith('Upper') ? 'Upper' : 'Lower'} day
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--muted)' }}>
                      Last: {getLastSessionForExercise(entry.exercise, selectedDay, selectedDate, appData) ?? 'none'}
                    </div>
                  </header>
                  <div className="card-body">
                    {entry.sets.map((set, i) => (
                      <div className="set-row" key={`${entry.exercise}-${i}`}>
                        <label>
                          Weight
                          <input
                            type="number"
                            min="0"
                            value={set.w}
                            readOnly={isLocked}
                            style={isLocked ? { opacity: 0.65, cursor: 'default' } : undefined}
                            onChange={(e) => updateEntry(entry.exercise, i, 'w', e.target.value)}
                          />
                        </label>
                        <label>
                          Reps
                          <input
                            type="number"
                            min="0"
                            value={set.r}
                            readOnly={isLocked}
                            style={isLocked ? { opacity: 0.65, cursor: 'default' } : undefined}
                            onChange={(e) => updateEntry(entry.exercise, i, 'r', e.target.value)}
                          />
                        </label>
                        <label>
                          Effort
                          <input
                            type="number"
                            min="0"
                            value={set.e ?? ''}
                            readOnly={isLocked}
                            style={isLocked ? { opacity: 0.65, cursor: 'default' } : undefined}
                            onChange={(e) => updateEntry(entry.exercise, i, 'e', e.target.value)}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '18px' }}>
              {!isLocked && (
                <button className="button-primary" type="button" onClick={persistSession}>
                  Save session
                </button>
              )}
              <button className="button-pill" type="button" onClick={copyForClaude}>
                Copy for Claude
              </button>
              {copySuccess && (
                <span style={{ color: 'var(--ok)', fontSize: '0.9rem' }}>{copySuccess}</span>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Custom exercises ─────────────────────────── */}
      <section className="section-card">
        <p className="eyebrow">Your exercises</p>
        <h2 style={{ marginTop: 0, marginBottom: '14px' }}>Custom exercises</h2>

        <button
          type="button"
          className="button-primary"
          style={{ width: '100%', marginBottom: '16px' }}
          onClick={openCustomModal}
        >
          Add custom exercise
        </button>

        {appData.custom.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            No custom exercises yet. Add one and it will appear in that day's session.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {dayNames.map((day) => {
              const exercises = appData.custom.filter((e) => e.day === day);
              if (!exercises.length) return null;
              return (
                <div key={day}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                    {day}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {exercises.map((exercise) => (
                      <div
                        key={exercise.name}
                        className="badge custom"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px' }}
                      >
                        {exercise.name}
                        <button
                          type="button"
                          style={{ border: 'none', background: 'transparent', color: 'var(--upper)', fontWeight: 700, cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '1rem' }}
                          onClick={() => handleDeleteCustomExercise(exercise.name, exercise.day)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Custom exercise modal ────────────────────── */}
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
                  placeholder="e.g. Bulgarian Split Squat"
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Day
                <select
                  value={customForm.day}
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, day: e.target.value as DayName }))}
                >
                  {dayNames.map((day) => (
                    <option key={day} value={day}>{day}</option>
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
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, sets: Number(e.target.value) }))}
                />
              </label>
              <label>
                Rep range
                <input
                  type="text"
                  value={customForm.reps}
                  placeholder="e.g. 8–12"
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, reps: e.target.value }))}
                />
              </label>
            </div>
            {customError && (
              <div className="small-text" style={{ color: 'var(--avoid)' }}>{customError}</div>
            )}
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
    </div>
  );
}
