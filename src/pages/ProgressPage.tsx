import { useEffect, useMemo, useState } from 'react';
import { EXERCISES } from '../data/exercises';
import { loadAppDataAsync } from '../storage';
import type { Session } from '../types';

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

export function ProgressPage() {
  const [exercise, setExercise] = useState('Leg Press');
  const [range, setRange] = useState<typeof rangeOptions[number]>('1M');
  const [appData, setAppData] = useState<{ sessions: Session[]; custom: any[] }>({ sessions: [], custom: [] });

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

  const exerciseNames = useMemo(() => {
    const custom = appData.custom.map((item) => item.name);
    return Array.from(new Set([...Object.keys(EXERCISES), ...custom])).sort();
  }, [appData.custom]);

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

  const chartPoints = useMemo(() => {
    const values = filteredSessions.map((session) => ({
      date: session.date,
      value: getTopWeight(session, exercise),
    }));
    const rawMax = Math.max(...values.map((item) => item.value), 1);
    const rawMin = Math.min(...values.map((item) => item.value));
    const range = rawMax - rawMin || rawMax;
    const pad = range * 0.25;
    const yLow = Math.max(0, rawMin - pad);
    const yHigh = rawMax + pad * 0.5;
    const span = yHigh - yLow || 1;
    return values.map((item, index) => ({
      ...item,
      x: values.length > 1 ? (index / (values.length - 1)) * 96 + 2 : 50,
      y: 90 - ((item.value - yLow) / span) * 80,
      yLow,
      yHigh,
    }));
  }, [filteredSessions, exercise]);

  const maxWeight = useMemo(() => Math.max(...filteredSessions.map((session) => getTopWeight(session, exercise)), 0), [filteredSessions, exercise]);
  const minWeight = useMemo(() => filteredSessions.length ? Math.min(...filteredSessions.map((session) => getTopWeight(session, exercise))) : 0, [filteredSessions, exercise]);

  return (
    <section className="section-card">
      <header>
        <p className="eyebrow">Progress</p>
        <h2>Track top-set performance</h2>
      </header>

      <div className="controls-row">
        <label style={{ flex: 1, minWidth: '220px' }}>
          Exercise
          <select value={exercise} onChange={(event) => setExercise(event.target.value)}>
            {exerciseNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
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
            <div>{filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}</div>
            <div>Top weight: {maxWeight}kg · Low: {minWeight}kg</div>
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
            {/* subtle gridlines at 10%, 50%, 90% y */}
            {[10, 50, 90].map((y) => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            ))}
            {/* y-axis labels (min / max) */}
            <text x="1" y="13" fontSize="4" fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {maxWeight}kg
            </text>
            <text x="1" y="93" fontSize="4" fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {minWeight}kg
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
              const isPeak = point.value === maxWeight;
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
                      {point.value}kg
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
                </div>
                <div>{getTopWeight(session, exercise)}kg</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
