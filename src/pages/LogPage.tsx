import { useEffect, useMemo, useRef, useState } from 'react';
import { addCustomExercise, clearDraftSession, createSessionDraft, deleteSession, findSession, loadAppDataAsync, loadDraftSession, removeCustomExercise, saveAppData, saveDraftSession } from '../storage';
import type { AppData, DayName, Session, SetEntry } from '../types';

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

function compareSessionDate(a: Session, b: Session) {
  return a.date.localeCompare(b.date);
}

function getLastSessionForExercise(exercise: string, day: DayName, date: string, data: AppData) {
  const last = data.sessions
    .filter((s) => s.day === day && s.date < date)
    .sort((a, b) => compareSessionDate(b, a))[0];
  if (!last) return null;
  const entry = last.entries.find((item) => item.exercise === exercise);
  if (!entry) return null;
  const set = entry.sets[0];
  return `${set.w}kg × ${set.r}${set.e !== null ? ` @ ${set.e}` : ''}`;
}

function getPriorSet(exercise: string, setIndex: number, day: DayName, date: string, data: AppData): SetEntry | null {
  const prior = data.sessions
    .filter((s) => s.day === day && s.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prior) return null;
  const entry = prior.entries.find((e) => e.exercise === exercise);
  const set = entry?.sets[setIndex];
  if (!set || (!set.w && !set.r)) return null;
  return set;
}

function getRepRange(exercise: string, day: DayName, data: AppData): string | null {
  const sessionProg = data.program?.find((s) => s.name === day);
  if (sessionProg) return sessionProg.exercises.find((e) => e.name === exercise)?.reps ?? null;
  return data.custom.find((c) => c.name === exercise && c.day === day)?.reps ?? null;
}

function calcVolume(session: Session): number {
  return session.entries.reduce(
    (total, entry) => total + entry.sets.reduce((sum, set) => sum + set.w * set.r, 0),
    0,
  );
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
    const noteLine = entry.notes?.trim() ? ` [${entry.notes.trim()}]` : '';
    lines.push(`${entry.exercise}: ${row || 'no data'}${noteLine}`);
  });
  return lines.join('\n');
}

export function LogPage() {
  const [selectedDay, setSelectedDay] = useState<DayName | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [appData, setAppData] = useState<AppData>({ sessions: [], custom: [] });
  const [draftSession, setDraftSession] = useState<Session | null>(null);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', day: 'Lower A', sets: 3, reps: '10–12' });
  const [customError, setCustomError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [setPopup, setSetPopup] = useState<{ exercise: string; setIndex: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [historyExercise, setHistoryExercise] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const exerciseRefs = useRef<Map<string, HTMLElement>>(new Map());
  const autoSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void loadAppDataAsync().then(({ data }) => setAppData(data));
    const onUpdate = () => void loadAppDataAsync().then(({ data }) => setAppData(data));
    window.addEventListener('app-data-updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('app-data-updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  useEffect(() => {
    setIsPartial(false);
    if (!selectedDate || !selectedDay) {
      setDraftSession(null);
      return;
    }
    const stored = findSession(selectedDate, selectedDay, appData);
    if (stored) { setDraftSession(stored); return; }
    // Restore auto-saved draft if one exists for this date/day
    const draft = loadDraftSession(selectedDate, selectedDay);
    setDraftSession(draft ?? createSessionDraft(selectedDate, selectedDay, appData));
  }, [selectedDate, selectedDay, appData]);

  // Scroll to next exercise when rest-timer-done fires
  useEffect(() => {
    const handler = (e: Event) => {
      const { nextExercise } = (e as CustomEvent<{ nextExercise?: string }>).detail;
      if (nextExercise) {
        const el = exerciseRefs.current.get(nextExercise);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('rest-timer-done', handler);
    return () => window.removeEventListener('rest-timer-done', handler);
  }, []);

  const currentSession = selectedDate && selectedDay
    ? (findSession(selectedDate, selectedDay, appData) ?? null)
    : null;
  const isLocked = currentSession !== null;

  // Auto-save draft every 5 seconds when unsaved data exists
  useEffect(() => {
    if (!draftSession || isLocked || !selectedDate || !selectedDay) return;
    const hasData = draftSession.entries.some((e) => e.sets.some((s) => s.w > 0 || s.r > 0));
    if (!hasData) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => saveDraftSession(draftSession), 5000);
    return () => { if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current); };
  }, [draftSession, isLocked, selectedDate, selectedDay]);

  const recentSessions = [...appData.sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const priorSession = selectedDate && selectedDay
    ? appData.sessions
        .filter((s) => s.day === selectedDay && s.date < selectedDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    : null;

  const historyData = useMemo(() => {
    if (!historyExercise) return [];
    return appData.sessions
      .filter((s) => s.entries.some((e) => e.exercise === historyExercise))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((s) => ({
        date: s.date,
        day: s.day,
        partial: s.partial,
        sets: s.entries.find((e) => e.exercise === historyExercise)?.sets ?? [],
      }));
  }, [historyExercise, appData.sessions]);

  const selectedProgram = selectedDay ? (appData.program?.find((s) => s.name === selectedDay) ?? null) : null;
  const isUpperDay = selectedProgram?.type === 'upper';
  const dayColor = isUpperDay ? 'var(--upper)' : 'var(--lower)';

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    const existing = appData.sessions.find((s) => s.date === date);
    setSelectedDay(existing?.day ?? null);
    setSetPopup(null);
  }

  function stepDate(delta: number) {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    handleDateChange(formatDate(d));
  }

  function handleDaySelect(day: DayName) {
    if (selectedDay === day) {
      if (!isLocked) setSelectedDay(null);
    } else if (selectedDay === null) {
      setSelectedDay(day);
    }
  }

  function toggleNotes(exercise: string) {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(exercise)) next.delete(exercise);
      else next.add(exercise);
      return next;
    });
  }

  function updateNotes(exercise: string, value: string) {
    if (isLocked) return;
    setDraftSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((entry) =>
          entry.exercise === exercise ? { ...entry, notes: value } : entry,
        ),
      };
    });
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

  function copySetFromPrevious(exercise: string, setIndex: number) {
    if (!draftSession || setIndex === 0) return;
    const prevSet = draftSession.entries.find((e) => e.exercise === exercise)?.sets[setIndex - 1];
    if (!prevSet) return;
    updateEntry(exercise, setIndex, 'w', String(prevSet.w));
    updateEntry(exercise, setIndex, 'r', String(prevSet.r));
    if (prevSet.e !== null) updateEntry(exercise, setIndex, 'e', String(prevSet.e));
  }

  function fillFromLastSession() {
    if (!selectedDay || isLocked || !priorSession) return;
    setDraftSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((entry) => {
          const priorEntry = priorSession.entries.find((e) => e.exercise === entry.exercise);
          if (!priorEntry) return entry;
          return {
            ...entry,
            sets: entry.sets.map((set, i) => {
              const ps = priorEntry.sets[i];
              return ps ? { ...ps } : set;
            }),
          };
        }),
      };
    });
    showToast(`Filled from ${formatShortDate(priorSession.date)}`);
  }

  function persistSession() {
    if (!draftSession || !selectedDay) return;
    const sessionToSave = isPartial ? { ...draftSession, partial: true } : draftSession;
    const filtered = appData.sessions.filter(
      (s) => !(s.date === selectedDate && s.day === selectedDay),
    );
    const nextData: AppData = {
      ...appData,
      sessions: [...filtered, sessionToSave].sort((a, b) => a.date.localeCompare(b.date)),
    };
    setAppData(nextData);
    saveAppData(nextData);
    clearDraftSession();
    const vol = calcVolume(sessionToSave);
    const partialNote = isPartial ? ' · incomplete' : '';
    showToast(vol > 0 ? `Session saved · ${vol.toLocaleString()} kg total${partialNote}` : 'Session saved');
  }

  function removeSession() {
    setShowDeleteConfirm(true);
  }

  function confirmDelete() {
    if (!selectedDay) return;
    setShowDeleteConfirm(false);
    clearDraftSession();
    const nextData = deleteSession(selectedDate, selectedDay, appData);
    setAppData(nextData);
    saveAppData(nextData);
    setDraftSession(createSessionDraft(selectedDate, selectedDay, nextData));
    showToast('Session deleted');
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
    showToast(`"${trimmed}" added to ${customForm.day}`);
  }

  function handleDeleteCustomExercise(name: string, day: DayName) {
    const nextData = removeCustomExercise(name, day, appData);
    setAppData(nextData);
    saveAppData(nextData);
    showToast(`"${name}" removed`);
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
    <div
      style={{ display: 'grid', gap: '16px' }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (setPopup || showDeleteConfirm || isCustomModalOpen || !selectedDate) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 80) stepDate(dx < 0 ? 1 : -1);
      }}
    >
      {/* ── Log session ─────────────────────────────── */}
      <section className="section-card">
        <p className="eyebrow">Workout log</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
          <h2 style={{ margin: 0 }}>Log session</h2>
          <a href="#custom-exercises" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}>
            Custom exercises ↓
          </a>
        </div>

        {/* Date field with Log today + nav arrows */}
        <div className="date-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label htmlFor="session-date" style={{ margin: 0 }}>Session date</label>
            {!selectedDate && (
              <button
                type="button"
                className="button-pill"
                style={{ fontSize: '0.82rem', minHeight: '34px', padding: '4px 14px' }}
                onClick={() => handleDateChange(formatDate(new Date()))}
              >
                Log today
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
            {selectedDate && (
              <button type="button" className="date-nav-btn" onClick={() => stepDate(-1)} aria-label="Previous day">
                ‹
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                id="session-date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>
            {selectedDate && (
              <button type="button" className="date-nav-btn" onClick={() => stepDate(1)} aria-label="Next day">
                ›
              </button>
            )}
          </div>
        </div>

        {/* Empty state with recent sessions */}
        {!selectedDate && (
          <div className="log-empty-state">
            {recentSessions.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                No sessions yet — tap "Log today" or pick a date to begin.
              </p>
            ) : (
              <>
                <p className="log-empty-hint">Recent sessions</p>
                <div className="recent-sessions-row">
                  {recentSessions.map((s) => (
                    <button
                      key={`${s.date}-${s.day}`}
                      type="button"
                      className="recent-session-pill"
                      onClick={() => { setSelectedDate(s.date); setSelectedDay(s.day); }}
                    >
                      <span className="recent-session-date">{formatShortDate(s.date)}</span>
                      <span className={`recent-session-day ${s.day.startsWith('Upper') ? 'upper' : 'lower'}`}>
                        {s.day}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Day pills */}
        {selectedDate && (
          <div className="day-pills">
            {(appData.program ?? []).map((session) => (
              <button
                key={session.name}
                type="button"
                className={`day-pill ${session.type} ${session.name === selectedDay ? 'active' : ''}`}
                disabled={selectedDay !== null && session.name !== selectedDay}
                onClick={() => handleDaySelect(session.name)}
              >
                {session.name}
                {session.name === selectedDay && !isLocked && (
                  <span className="day-pill-clear" aria-hidden="true">×</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Exercise grid */}
        {selectedDate && selectedDay && draftSession && (
          <>
            {isLocked && (
              <div className="session-locked-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Session saved — read only</span>
                  {calcVolume(draftSession) > 0 && (
                    <span style={{ color: 'var(--ok)', fontSize: '0.82rem' }}>
                      {calcVolume(draftSession).toLocaleString()} kg
                    </span>
                  )}
                  {currentSession?.partial && (
                    <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '999px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                      INCOMPLETE
                    </span>
                  )}
                </div>
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

            {!isLocked && priorSession && (
              <div className="same-as-last-banner">
                <div>
                  <span className="same-as-last-label">Same as last time?</span>
                  <span className="same-as-last-meta">
                    {formatShortDate(priorSession.date)}
                    {calcVolume(priorSession) > 0 && ` · ${calcVolume(priorSession).toLocaleString()} kg`}
                  </span>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  style={{ minHeight: '38px', padding: '7px 18px', fontSize: '0.88rem' }}
                  onClick={fillFromLastSession}
                >
                  Fill in
                </button>
              </div>
            )}

            <div className="exercise-grid">
              {draftSession.entries.map((entry) => {
                const repRange = getRepRange(entry.exercise, selectedDay, appData);
                return (
                  <article
                    className="exercise-card"
                    key={entry.exercise}
                    ref={(el) => { if (el) exerciseRefs.current.set(entry.exercise, el); }}
                    style={{ borderTopColor: dayColor }}
                  >
                    <header>
                      <div>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                          onClick={() => setHistoryExercise(entry.exercise)}
                        >
                          <h3 style={{ margin: 0 }}>{entry.exercise}</h3>
                          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>tap for history</span>
                        </button>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          <span className="badge">{entry.sets.length} sets</span>
                          {repRange && (
                            <span className={`badge ${isUpperDay ? 'day-upper' : 'day-lower'}`}>
                              {repRange} reps
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--muted)', flexShrink: 0 }}>
                        Last: {getLastSessionForExercise(entry.exercise, selectedDay, selectedDate, appData) ?? 'none'}
                      </div>
                    </header>
                    <div className="card-body">
                      {entry.sets.map((set, i) => (
                        <button
                          key={`${entry.exercise}-${i}`}
                          type="button"
                          className={`set-display-row${!isLocked ? ' set-display-row--tap' : ''}`}
                          disabled={isLocked}
                          onClick={() => setSetPopup({ exercise: entry.exercise, setIndex: i })}
                        >
                          <div className="set-display-cell">
                            <span className="set-display-label">Weight</span>
                            <span className="set-display-value">{set.w || 0}</span>
                          </div>
                          <div className="set-display-cell">
                            <span className="set-display-label">Reps</span>
                            <span className="set-display-value">{set.r || 0}</span>
                          </div>
                          <div className="set-display-cell">
                            <span className="set-display-label">Effort</span>
                            <span className="set-display-value">{set.e ?? '—'}</span>
                          </div>
                          <span className="set-display-index">S{i + 1}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => toggleNotes(entry.exercise)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'transparent',
                          border: 'none',
                          color: entry.notes?.trim() ? 'var(--accent)' : 'var(--muted)',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          padding: '6px 0 2px',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem' }}>{openNotes.has(entry.exercise) ? '▼' : '▶'}</span>
                        Notes{entry.notes?.trim() ? ' ·' : ''}
                        {entry.notes?.trim() && (
                          <span style={{ color: 'var(--muted)', fontWeight: 400, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.notes.trim()}
                          </span>
                        )}
                      </button>
                      {openNotes.has(entry.exercise) && (
                        <textarea
                          rows={3}
                          value={entry.notes ?? ''}
                          readOnly={isLocked}
                          placeholder="Add notes for this exercise…"
                          onChange={(e) => updateNotes(entry.exercise, e.target.value)}
                          style={{
                            width: '100%',
                            marginTop: '6px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            padding: '10px 12px',
                            resize: 'vertical',
                            background: 'rgba(255,255,255,0.04)',
                            color: isLocked ? 'var(--muted)' : 'var(--ink)',
                            fontSize: '0.9rem',
                            fontFamily: 'inherit',
                            opacity: isLocked ? 0.7 : 1,
                          }}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '18px' }}>
              {!isLocked && (
                <>
                  <button className="button-primary" type="button" onClick={persistSession}>
                    Save session
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={isPartial}
                      onChange={(e) => setIsPartial(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Mark as incomplete</span>
                  </label>
                </>
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
      <section id="custom-exercises" className="section-card">
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
            {(appData.program ?? []).map(({ name: day }) => {
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
                  onChange={(e) => setCustomForm((prev) => ({ ...prev, day: e.target.value }))}
                >
                  {(appData.program ?? []).map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
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

      {/* ── Delete confirmation modal ─────────────────── */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ maxWidth: '360px' }}>
            <h3 style={{ marginBottom: '10px' }}>Delete session?</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 22px' }}>
              All data for {selectedDay} on {selectedDate} will be removed. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="button-pill" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button-primary"
                style={{ flex: 1, background: 'var(--avoid)', borderRadius: '999px' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set entry popup ──────────────────────────── */}
      {(() => {
        if (!setPopup || !draftSession || isLocked) return null;
        const popupEntry = draftSession.entries.find((e) => e.exercise === setPopup.exercise);
        const popupSet = popupEntry?.sets[setPopup.setIndex];
        if (!popupEntry || !popupSet) return null;
        const totalSets = popupEntry.sets.length;
        const hasNext = setPopup.setIndex < totalSets - 1;
        const priorSet = getPriorSet(setPopup.exercise, setPopup.setIndex, selectedDay!, selectedDate, appData);
        const prevSet = setPopup.setIndex > 0 ? popupEntry.sets[setPopup.setIndex - 1] : null;
        function closePopup() {
          const session = draftSession!;
          const popup = setPopup!;
          const exerciseIndex = session.entries.findIndex((e) => e.exercise === popup.exercise);
          const isLastSet = popup.setIndex === totalSets - 1;
          const nextExercise = isLastSet ? session.entries[exerciseIndex + 1]?.exercise : undefined;
          const sessionProg = appData.program?.find((s) => s.name === selectedDay);
          const restSeconds = sessionProg?.exercises.find((e) => e.name === popup.exercise)?.restSeconds;
          window.dispatchEvent(new CustomEvent('rest-timer-start', {
            detail: { exercise: popup.exercise, isLastSet, nextExercise, restSeconds },
          }));
          setSetPopup(null);
        }
        return (
          <div className="bottom-sheet-overlay" onClick={closePopup}>
            <div className="set-popup" onClick={(e) => e.stopPropagation()}>
              <div className="set-popup-handle" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {setPopup.exercise}
                  </p>
                  <p style={{ margin: '2px 0 0', color: 'var(--accent)', fontWeight: 600, fontSize: '1rem' }}>
                    Set {setPopup.setIndex + 1} of {totalSets}
                  </p>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '1.4rem', lineHeight: 1, padding: '4px', cursor: 'pointer' }}
                  onClick={closePopup}
                >
                  ×
                </button>
              </div>
              {priorSet && (
                <p style={{ margin: '6px 0 14px', color: 'var(--muted)', fontSize: '0.82rem' }}>
                  Last session: {priorSet.w}kg × {priorSet.r}{priorSet.e !== null ? ` @ ${priorSet.e}` : ''}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <label>
                  Weight (kg)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={popupSet.w}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateEntry(setPopup.exercise, setPopup.setIndex, 'w', e.target.value)}
                    style={{ fontSize: '1.2rem', textAlign: 'center', padding: '14px 8px' }}
                  />
                </label>
                <label>
                  Reps
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={popupSet.r}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateEntry(setPopup.exercise, setPopup.setIndex, 'r', e.target.value)}
                    style={{ fontSize: '1.2rem', textAlign: 'center', padding: '14px 8px' }}
                  />
                </label>
                <label>
                  Effort
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={popupSet.e ?? ''}
                    placeholder="—"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateEntry(setPopup.exercise, setPopup.setIndex, 'e', e.target.value)}
                    style={{ fontSize: '1.2rem', textAlign: 'center', padding: '14px 8px' }}
                  />
                </label>
              </div>
              {prevSet && (prevSet.w || prevSet.r) ? (
                <button
                  type="button"
                  className="button-pill"
                  style={{ width: '100%', marginBottom: '12px', fontSize: '0.85rem', minHeight: '40px' }}
                  onClick={() => copySetFromPrevious(setPopup.exercise, setPopup.setIndex)}
                >
                  Copy from Set {setPopup.setIndex} · {prevSet.w}kg × {prevSet.r}
                </button>
              ) : null}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="button-pill" style={{ flex: 1 }} onClick={closePopup}>
                  Done
                </button>
                {hasNext && (
                  <button
                    type="button"
                    className="button-primary"
                    style={{ flex: 2 }}
                    onClick={() => {
                      const sessionProg = appData.program?.find((s) => s.name === selectedDay);
                      const restSeconds = sessionProg?.exercises.find((e) => e.name === setPopup.exercise)?.restSeconds;
                      window.dispatchEvent(new CustomEvent('rest-timer-start', {
                        detail: { exercise: setPopup.exercise, isLastSet: false, restSeconds },
                      }));
                      setSetPopup({ exercise: setPopup.exercise, setIndex: setPopup.setIndex + 1 });
                    }}
                  >
                    Next set →
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Exercise history drawer ──────────────────── */}
      {historyExercise && (
        <div className="modal-overlay" onClick={() => setHistoryExercise(null)}>
          <div className="modal-panel history-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{historyExercise}</h3>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: '4px' }}
                onClick={() => setHistoryExercise(null)}
              >×</button>
            </div>
            {historyData.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>No history yet for this exercise.</p>
            ) : (
              <div className="history-drawer-list">
                {historyData.map((session) => (
                  <div key={session.date} className="history-drawer-item">
                    <div className="history-drawer-header">
                      <span className="history-drawer-date">{session.date}</span>
                      <span className={`history-drawer-day ${session.day.startsWith('Upper') ? 'upper' : 'lower'}`}>{session.day}</span>
                      {session.partial && <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>incomplete</span>}
                    </div>
                    <div className="history-drawer-sets">
                      {session.sets.map((set, i) => (
                        <span key={i} className="history-drawer-set">
                          S{i + 1}: {set.w}kg × {set.r}{set.e !== null ? ` @${set.e}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
