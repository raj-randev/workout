import { useEffect, useMemo, useRef, useState } from 'react';
import { loadAppDataAsync } from '../storage';
import type { AppData, Session } from '../types';

const rangeOptions = ['1W', '1M', '3M', '6M', '1Y', 'All'] as const;

function getCutoffDate(option: typeof rangeOptions[number]): Date | null {
  const now = new Date();
  switch (option) {
    case '1W':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '1M':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3M':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6M':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case '1Y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    default:
      return null;
  }
}

function getTopWeight(session: Session, exercise: string) {
  const entry = session.entries.find((item) => item.exercise === exercise);
  if (!entry) return 0;
  return Math.max(...entry.sets.map((set) => set.w));
}

function getSessionVolume(session: Session, exercise: string) {
  const entry = session.entries.find((item) => item.exercise === exercise);
  return entry?.sets.reduce((sum, set) => sum + set.w * set.r, 0) ?? 0;
}

function formatVal(v: number, metric: 'weight' | 'volume') {
  if (metric === 'volume') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
  return `${v}kg`;
}

export function ProgressPage() {
  const [exercise, setExercise] = useState('Leg Press');
  const [range, setRange] = useState<typeof rangeOptions[number]>('1M');
  const [metric, setMetric] = useState<'weight' | 'volume'>('weight');
  const [appData, setAppData] = useState<AppData>({ sessions: [], custom: [] });
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadAppDataAsync().then(({ data }) => setAppData(data));
    const onStorageUpdate = () => {
      void loadAppDataAsync().then(({ data }) => setAppData(data));
    };
    window.addEventListener('app-data-updated', onStorageUpdate);
    window.addEventListener('storage', onStorageUpdate);
    return () => {
      window.removeEventListener('app-data-updated', onStorageUpdate);
      window.removeEventListener('storage', onStorageUpdate);
    };
  }, []);

  // Click-outside closes the dropdown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setExerciseSearch('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const groupedExercises = useMemo(() => {
    const q = exerciseSearch.toLowerCase().trim();
    const lower = new Set<string>();
    const upper = new Set<string>();
    (appData.program ?? []).forEach((session) => {
      const bucket = session.type === 'upper' ? upper : lower;
      session.exercises.forEach(({ name }) => {
        if (!q || name.toLowerCase().includes(q)) bucket.add(name);
      });
    });
    // Also include any custom exercises not in program
    appData.custom.forEach((c) => {
      const isUpper = c.day.startsWith('Upper');
      if (!q || c.name.toLowerCase().includes(q)) (isUpper ? upper : lower).add(c.name);
    });
    return { Lower: Array.from(lower).sort(), Upper: Array.from(upper).sort() };
  }, [exerciseSearch, appData.program, appData.custom]);

  const filteredSessions = useMemo(() => {
    const cutoff = getCutoffDate(range);
    return appData.sessions
      .filter((session) => session.entries.some((entry) => entry.exercise === exercise))
      .filter((session) => {
        if (!cutoff) return true;
        return new Date(session.date) >= cutoff;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [appData.sessions, exercise, range]);

  const getVal = (session: Session) =>
    metric === 'volume' ? getSessionVolume(session, exercise) : getTopWeight(session, exercise);

  const chartPoints = useMemo(() => {
    const values = filteredSessions.map((session) => ({
      date: session.date,
      value: metric === 'volume' ? getSessionVolume(session, exercise) : getTopWeight(session, exercise),
    }));
    const rawMax = Math.max(...values.map((v) => v.value), 1);
    const rawMin = Math.min(...values.map((v) => v.value));
    const span = rawMax - rawMin;
    return values.map((item, index) => ({
      ...item,
      x: values.length > 1 ? (index / (values.length - 1)) * 188 + 6 : 100,
      y: span === 0 ? 46 : 80 - ((item.value - rawMin) / span) * 68,
    }));
  }, [filteredSessions, exercise, metric]);

  const maxVal = useMemo(() => Math.max(...filteredSessions.map(getVal), 0), [filteredSessions, exercise, metric]);
  const minVal = useMemo(() => filteredSessions.length ? Math.min(...filteredSessions.map(getVal)) : 0, [filteredSessions, exercise, metric]);

  const isNewPB = useMemo(() => {
    if (filteredSessions.length < 2 || metric !== 'weight') return false;
    const lastSession = filteredSessions[filteredSessions.length - 1];
    if (lastSession.partial) return false;
    const lastWeight = getTopWeight(lastSession, exercise);
    return lastWeight === maxVal && filteredSessions.slice(0, -1).every((s) => getTopWeight(s, exercise) < lastWeight);
  }, [filteredSessions, exercise, maxVal, metric]);

  const best1RM = useMemo(() => {
    let best = 0;
    for (const session of appData.sessions) {
      const entry = session.entries.find((e) => e.exercise === exercise);
      if (!entry) continue;
      for (const set of entry.sets) {
        if (!set.w || !set.r) continue;
        const e1rm = set.r === 1 ? set.w : set.w * (1 + set.r / 30);
        if (e1rm > best) best = e1rm;
      }
    }
    return Math.round(best);
  }, [appData.sessions, exercise]);

  const dateRange = filteredSessions.length > 1
    ? `${filteredSessions[0].date} – ${filteredSessions[filteredSessions.length - 1].date}`
    : null;

  const { streak, heatmapDays } = useMemo(() => {
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().slice(0, 10);
    const sessionMap = new Map<string, 'lower' | 'upper'>();
    appData.sessions.forEach((s) => {
      if (!sessionMap.has(s.date)) sessionMap.set(s.date, s.day.startsWith('Upper') ? 'upper' : 'lower');
    });

    // Streak: consecutive days with a session going back from today
    let streakCount = 0;
    const d = new Date(todayDate);
    while (sessionMap.has(d.toISOString().slice(0, 10))) {
      streakCount++;
      d.setDate(d.getDate() - 1);
    }

    // 12-week heatmap aligned to Monday
    const dow = todayDate.getDay(); // 0=Sun
    const daysToMon = dow === 0 ? 6 : dow - 1;
    const lastMonday = new Date(todayDate);
    lastMonday.setDate(todayDate.getDate() - daysToMon);
    const startDate = new Date(lastMonday);
    startDate.setDate(lastMonday.getDate() - 11 * 7); // 12 weeks back

    const days = Array.from({ length: 84 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const str = date.toISOString().slice(0, 10);
      return { date: str, type: sessionMap.get(str) ?? null, isToday: str === todayStr };
    });

    return { streak: streakCount, heatmapDays: days };
  }, [appData.sessions]);

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
    {/* ── Consistency card ─────────────────────────── */}
    <section className="section-card">
      <p className="eyebrow">Consistency</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Training heatmap</h2>
        {streak > 0 && (
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ok)' }}>
            {streak} day streak
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '1px' }}>
          {['M','T','W','T','F','S','S'].map((label, i) => (
            <span key={i} style={{ fontSize: '0.62rem', color: 'var(--muted)', width: '10px', height: '16px', lineHeight: '16px', textAlign: 'center' }}>{label}</span>
          ))}
        </div>
        {/* Grid: 12 columns (weeks) × 7 rows (days) */}
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 16px)', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: '3px', flex: 1 }}>
          {heatmapDays.map((cell) => (
            <div
              key={cell.date}
              title={cell.date}
              style={{
                borderRadius: '3px',
                background: cell.type === 'lower'
                  ? 'rgba(15,184,168,0.65)'
                  : cell.type === 'upper'
                  ? 'rgba(129,140,248,0.65)'
                  : 'rgba(255,255,255,0.06)',
                outline: cell.isToday ? '2px solid var(--accent)' : undefined,
                outlineOffset: '1px',
              }}
            />
          ))}
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginTop: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(15,184,168,0.65)' }} />
          Lower
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(129,140,248,0.65)' }} />
          Upper
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', outline: '2px solid var(--accent)', outlineOffset: '1px' }} />
          Today
        </span>
      </div>
    </section>

    {/* ── Exercise chart card ───────────────────────── */}
    <section className="section-card">
      <header>
        <p className="eyebrow">Progress</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>{metric === 'weight' ? 'Top-set weight' : 'Session volume'}</h2>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button type="button" className={`day-pill${metric === 'weight' ? ' active' : ''}`} onClick={() => setMetric('weight')}>Weight</button>
            <button type="button" className={`day-pill${metric === 'volume' ? ' active' : ''}`} onClick={() => setMetric('volume')}>Volume</button>
          </div>
        </div>
      </header>

      <div className="controls-row">
        <div ref={searchRef} className="exercise-search-wrapper">
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px' }}>
            Exercise
          </label>
          <div className="exercise-search-field" onClick={() => setDropdownOpen(true)}>
            <input
              type="text"
              className="exercise-search-input"
              placeholder={exercise}
              value={exerciseSearch}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => setExerciseSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setDropdownOpen(false); setExerciseSearch(''); } }}
            />
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem', flexShrink: 0, pointerEvents: 'none' }}>▾</span>
          </div>
          {dropdownOpen && (
            <div className="exercise-dropdown">
              {(['Lower', 'Upper'] as const).map((group) => {
                const items = groupedExercises[group];
                if (!items.length) return null;
                return (
                  <div key={group}>
                    <p className={`exercise-dropdown-group ${group.toLowerCase()}`}>{group}</p>
                    {items.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`exercise-dropdown-item${name === exercise ? ' active' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setExercise(name);
                          setExerciseSearch('');
                          setDropdownOpen(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {rangeOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`day-pill ${range === option ? 'active' : ''}`}
              onClick={() => setRange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div style={{ color: 'var(--muted)', marginTop: '16px', fontSize: '0.9rem' }}>
          No session data found for {exercise} in this range. Save a session in the Log tab to see the chart.
        </div>
      ) : (
        <div className="chart-panel">
          <div className="chart-meta">
            <div>
              {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
              {dateRange && <span style={{ color: 'var(--muted)', marginLeft: '6px', fontSize: '0.82rem' }}>({dateRange})</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {isNewPB && (
                  <span style={{
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: 'var(--ok)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '999px',
                    padding: '2px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}>
                    NEW PB
                  </span>
                )}
                {metric === 'weight' && best1RM > 0 && (
                  <span style={{
                    background: 'rgba(74, 143, 232, 0.1)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(74, 143, 232, 0.25)',
                    borderRadius: '999px',
                    padding: '2px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}>
                    est. 1RM {best1RM}kg
                  </span>
                )}
              </div>
              <span>
                {metric === 'weight'
                  ? `Top: ${maxVal}kg · Low: ${minVal}kg`
                  : `Max: ${maxVal.toLocaleString()} kg · Min: ${minVal.toLocaleString()} kg`
                }
              </span>
            </div>
          </div>
          <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="chart-svg">
            {/* subtle gridlines at 10%, 50%, 90% y */}
            {[10, 50, 90].map((y) => (
              <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            ))}
            {/* y-axis labels */}
            <text x="6" y="10" fontSize="4" fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatVal(maxVal, metric)}
            </text>
            <text x="6" y="96" fontSize="4" fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatVal(minVal, metric)}
            </text>
            {/* gradient fill under the line */}
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {chartPoints.length > 1 && (
              <polygon
                fill="url(#chartFill)"
                points={[
                  ...chartPoints.map((p) => `${p.x},${p.y}`),
                  `${chartPoints[chartPoints.length - 1].x},100`,
                  `${chartPoints[0].x},100`,
                ].join(' ')}
              />
            )}
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            />
            {chartPoints.map((point, i) => {
              const isFirst = i === 0;
              const isLast = i === chartPoints.length - 1;
              const isPeak = point.value === maxVal;
              const showLabel = isFirst || isLast || isPeak;
              return (
                <g key={point.date}>
                  <circle cx={point.x} cy={point.y} r={isPeak ? 3 : 2} fill={isPeak ? 'var(--ok)' : 'var(--upper)'} />
                  {showLabel && (
                    <text
                      x={point.x}
                      y={point.y - 4}
                      textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                      fontSize="4"
                      fill="var(--ink)"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatVal(point.value, metric)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="history-list">
            {filteredSessions.map((session) => (
              <div key={`${session.date}-${session.day}`} className="history-item">
                <div>
                  <strong>{session.date}</strong> · {session.day}
                  {session.partial && (
                    <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>incomplete</span>
                  )}
                </div>
                <div>
                  {metric === 'volume'
                    ? `${getSessionVolume(session, exercise).toLocaleString()} kg`
                    : `${getTopWeight(session, exercise)}kg`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
    </div>
  );
}
