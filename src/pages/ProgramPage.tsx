import { useState } from 'react';
import { initializeProgram, loadAppData, saveAppData } from '../storage';
import type { AppData, ExerciseProgramEntry, SessionProgram } from '../types';

const REST_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2m', value: 120 },
  { label: '3m', value: 180 },
];

export function ProgramPage() {
  const [appData, setAppData] = useState<AppData>(() => {
    const data = loadAppData();
    if (!data.program) {
      const next = { ...data, program: initializeProgram(data) };
      saveAppData(next);
      return next;
    }
    return data;
  });

  const program = appData.program!;

  function commit(newProgram: SessionProgram[]) {
    const next = { ...appData, program: newProgram };
    setAppData(next);
    saveAppData(next);
  }

  function updateSession(idx: number, patch: Partial<SessionProgram>) {
    commit(program.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function updateExercise(sIdx: number, eIdx: number, patch: Partial<ExerciseProgramEntry>) {
    commit(
      program.map((s, si) =>
        si !== sIdx ? s : {
          ...s,
          exercises: s.exercises.map((e, ei) => (ei === eIdx ? { ...e, ...patch } : e)),
        }
      )
    );
  }

  function removeExercise(sIdx: number, eIdx: number) {
    commit(
      program.map((s, si) =>
        si !== sIdx ? s : { ...s, exercises: s.exercises.filter((_, ei) => ei !== eIdx) }
      )
    );
  }

  function moveExercise(sIdx: number, eIdx: number, dir: -1 | 1) {
    const to = eIdx + dir;
    if (to < 0 || to >= program[sIdx].exercises.length) return;
    commit(
      program.map((s, si) => {
        if (si !== sIdx) return s;
        const exs = [...s.exercises];
        [exs[eIdx], exs[to]] = [exs[to], exs[eIdx]];
        return { ...s, exercises: exs };
      })
    );
  }

  function addExercise(sIdx: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    commit(
      program.map((s, si) =>
        si !== sIdx ? s : {
          ...s,
          exercises: [...s.exercises, { name: trimmed, sets: 3, reps: '8–12', restSeconds: 60 }],
        }
      )
    );
  }

  function removeSession(idx: number) {
    if (!window.confirm(`Delete "${program[idx].name}"? Past sessions are not affected.`)) return;
    commit(program.filter((_, i) => i !== idx));
  }

  function addSession() {
    if (!newSession.name.trim()) return;
    commit([...program, { name: newSession.name.trim(), type: newSession.type, exercises: [] }]);
    setNewSession({ name: '', type: 'upper' });
  }

  const [addInputs, setAddInputs] = useState<Record<number, string>>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [newSession, setNewSession] = useState<{ name: string; type: 'upper' | 'lower' }>({
    name: '',
    type: 'upper',
  });

  function commitNameEdit(idx: number) {
    if (editNameVal.trim()) updateSession(idx, { name: editNameVal.trim() });
    setEditingIdx(null);
  }

  return (
    <div className="page-content">
      <p className="page-hint">Tap a session name to rename it. Tap Upper/Lower to toggle the colour.</p>

      {program.map((session, sIdx) => (
        <div key={sIdx} className={`program-card card ${session.type}`}>
          {/* Session header */}
          <div className="program-session-header">
            {editingIdx === sIdx ? (
              <input
                className="program-name-input"
                value={editNameVal}
                autoFocus
                onChange={(e) => setEditNameVal(e.target.value)}
                onBlur={() => commitNameEdit(sIdx)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            ) : (
              <button
                type="button"
                className="program-name-btn"
                onClick={() => { setEditingIdx(sIdx); setEditNameVal(session.name); }}
              >
                {session.name}
              </button>
            )}
            <button
              type="button"
              className={`badge program-type-badge ${session.type === 'upper' ? 'day-upper' : 'day-lower'}`}
              onClick={() => updateSession(sIdx, { type: session.type === 'upper' ? 'lower' : 'upper' })}
            >
              {session.type === 'upper' ? 'Upper' : 'Lower'}
            </button>
            <button type="button" className="program-session-del" onClick={() => removeSession(sIdx)}>
              ×
            </button>
          </div>

          {/* Exercise rows */}
          {session.exercises.map((ex, eIdx) => (
            <div key={eIdx} className="program-exercise-row">
              <div className="program-ex-top">
                <div className="program-move-btns">
                  <button
                    type="button"
                    disabled={eIdx === 0}
                    onClick={() => moveExercise(sIdx, eIdx, -1)}
                  >↑</button>
                  <button
                    type="button"
                    disabled={eIdx === session.exercises.length - 1}
                    onClick={() => moveExercise(sIdx, eIdx, 1)}
                  >↓</button>
                </div>
                <span className="program-ex-name">{ex.name}</span>
                <button
                  type="button"
                  className="program-ex-del"
                  onClick={() => removeExercise(sIdx, eIdx)}
                >×</button>
              </div>
              <div className="program-ex-bottom">
                <div className="program-sets-stepper">
                  <button
                    type="button"
                    disabled={ex.sets <= 1}
                    onClick={() => updateExercise(sIdx, eIdx, { sets: ex.sets - 1 })}
                  >−</button>
                  <span>{ex.sets} sets</span>
                  <button
                    type="button"
                    disabled={ex.sets >= 10}
                    onClick={() => updateExercise(sIdx, eIdx, { sets: ex.sets + 1 })}
                  >+</button>
                </div>
                <div className="program-rest-pill">
                  <span className="program-rest-label-text">rest</span>
                  <select
                    className="program-rest-select"
                    value={ex.restSeconds}
                    onChange={(e) => updateExercise(sIdx, eIdx, { restSeconds: Number(e.target.value) })}
                  >
                    {REST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {/* Add exercise input */}
          <div className="program-add-row">
            <input
              type="text"
              className="program-add-input"
              placeholder="Add exercise…"
              value={addInputs[sIdx] ?? ''}
              onChange={(e) => setAddInputs((prev) => ({ ...prev, [sIdx]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addExercise(sIdx, addInputs[sIdx] ?? '');
                  setAddInputs((prev) => ({ ...prev, [sIdx]: '' }));
                }
              }}
            />
            <button
              type="button"
              className="button-pill"
              onClick={() => {
                addExercise(sIdx, addInputs[sIdx] ?? '');
                setAddInputs((prev) => ({ ...prev, [sIdx]: '' }));
              }}
            >
              Add
            </button>
          </div>
        </div>
      ))}

      {/* Add new session */}
      <div className="program-card card">
        <p className="eyebrow" style={{ marginBottom: '12px' }}>New session</p>
        <div className="program-new-session-row">
          <input
            type="text"
            className="program-add-input"
            placeholder="Session name (e.g. Full Body)"
            value={newSession.name}
            onChange={(e) => setNewSession((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') addSession(); }}
          />
          <select
            className="program-type-select"
            value={newSession.type}
            onChange={(e) => setNewSession((prev) => ({ ...prev, type: e.target.value as 'upper' | 'lower' }))}
          >
            <option value="upper">Upper</option>
            <option value="lower">Lower</option>
          </select>
          <button type="button" className="button-primary" style={{ minHeight: '44px' }} onClick={addSession}>
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
