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
    const maxValue = Math.max(...values.map((item) => item.value), 1);
    return values.map((item, index) => ({
      ...item,
      x: values.length > 1 ? (index / (values.length - 1)) * 100 : 50,
      y: 100 - (item.value / maxValue) * 100,
    }));
  }, [filteredSessions, exercise]);

  const maxWeight = useMemo(() => Math.max(...filteredSessions.map((session) => getTopWeight(session, exercise)), 0), [filteredSessions, exercise]);

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
        <div style={{ color: '#6a7180', marginTop: '16px' }}>
          No session data found for {exercise} in this range. Save a session in the Log tab to see the chart.
        </div>
      ) : (
        <div className="chart-panel">
          <div className="chart-meta">
            <div>{filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}</div>
            <div>Top weight: {maxWeight}kg</div>
          </div>
          <svg viewBox="0 0 100 120" preserveAspectRatio="none" className="chart-svg">
            <polyline
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
            />
            {chartPoints.map((point) => (
              <g key={point.date}>
                <circle cx={point.x} cy={point.y} r="2.5" fill="var(--upper)" />
                <text x={point.x} y={point.y - 4} textAnchor="middle" fontSize="3.5" fill="#f7f6f2">
                  {point.value}
                </text>
              </g>
            ))}
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
