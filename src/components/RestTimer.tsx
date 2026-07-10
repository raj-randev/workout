const SET_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '45s', seconds: 45 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
];

const EXERCISE_PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
];

const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;

export type TimerContext = {
  exercise: string;
  isLastSet: boolean;
  nextExercise?: string;
};

type Props = {
  seconds: number;
  total: number;
  context: TimerContext | null;
  onStart: (duration: number) => void;
  onDismiss: () => void;
};

export function RestTimer({ seconds, total, context, onStart, onDismiss }: Props) {
  const isBetweenSets = context ? !context.isLastSet : false;
  const presets = isBetweenSets ? SET_PRESETS : EXERCISE_PRESETS;
  const isDone = seconds <= 0;
  const isUrgent = !isDone && seconds <= 10;
  const fraction = total > 0 ? Math.max(0, seconds) / total : 0;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.abs(seconds) % 60;
  const timeDisplay = `${mins}:${String(secs).padStart(2, '0')}`;
  const arcColor = isDone ? 'var(--ok)' : isUrgent ? '#f59e0b' : 'var(--accent)';

  return (
    <div className="rest-timer-overlay" onClick={onDismiss}>
      <div className={`rest-timer-modal${isUrgent ? ' urgent' : ''}${isDone ? ' done' : ''}`} onClick={(e) => e.stopPropagation()}>

        <button type="button" className="rest-timer-close" onClick={onDismiss} aria-label="Dismiss timer">×</button>

        {/* Large arc ring */}
        <div className="rest-timer-ring-wrap">
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ display: 'block' }}>
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
            <circle
              cx="70" cy="70" r={R}
              fill="none"
              stroke={arcColor}
              strokeWidth="7"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
            />
          </svg>
          <div className="rest-timer-ring-center">
            {isDone
              ? <span className="rest-timer-done-check">✓</span>
              : <span className={`rest-timer-big-time${isUrgent ? ' urgent' : ''}`}>{timeDisplay}</span>
            }
          </div>
        </div>

        {/* Status */}
        {isDone ? (
          <div className="rest-timer-done-info">
            <p className="rest-timer-done-title">Rest complete</p>
            {context?.nextExercise && (
              <p className="rest-timer-next-exercise">Next up: {context.nextExercise}</p>
            )}
          </div>
        ) : (
          <p className="rest-timer-exercise-label">
            {context?.exercise ?? 'Rest timer'}
            {context && !context.isLastSet && <span className="rest-timer-set-hint"> · set rest</span>}
          </p>
        )}

        {/* Preset row */}
        <div className="rest-timer-preset-row">
          {presets.map((p) => (
            <button
              key={p.seconds}
              type="button"
              className={`rest-timer-preset-btn${p.seconds === total ? ' active' : ''}`}
              onClick={() => onStart(p.seconds)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Primary action */}
        <button
          type="button"
          className="button-primary"
          style={{ width: '100%', minHeight: '52px', fontSize: '1rem', marginTop: '4px' }}
          onClick={isDone ? onDismiss : () => onStart(total)}
        >
          {isDone ? 'Continue' : '↺  Restart'}
        </button>
      </div>
    </div>
  );
}
