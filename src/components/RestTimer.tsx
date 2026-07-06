const PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
];

const R = 13;
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 81.68

type Props = {
  seconds: number;
  total: number;
  onStart: (duration: number) => void;
  onDismiss: () => void;
};

export function RestTimer({ seconds, total, onStart, onDismiss }: Props) {
  const isDone = seconds <= 0;
  const isUrgent = !isDone && seconds <= 10;
  const fraction = total > 0 ? Math.max(0, seconds) / total : 0;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.abs(seconds) % 60;
  const timeDisplay = `${mins}:${String(secs).padStart(2, '0')}`;
  const arcColor = isDone ? 'var(--ok)' : isUrgent ? '#f59e0b' : 'var(--accent)';

  return (
    <div className={`rest-timer${isDone ? ' rest-timer--done' : ''}${isUrgent ? ' rest-timer--urgent' : ''}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
        <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
        <circle
          cx="16" cy="16" r={R}
          fill="none"
          stroke={arcColor}
          strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
        />
      </svg>

      {isDone ? (
        <>
          <span className="rest-timer-done-label">Rest done!</span>
          <div className="rest-timer-presets">
            {PRESETS.map((p) => (
              <button key={p.seconds} type="button" className="rest-timer-preset" onClick={() => onStart(p.seconds)}>
                {p.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <span className={`rest-timer-time${isUrgent ? ' urgent' : ''}`}>{timeDisplay}</span>
          <button type="button" className="rest-timer-restart" onClick={() => onStart(total)} aria-label="Restart timer">
            ↺
          </button>
        </>
      )}

      <button type="button" className="rest-timer-dismiss" onClick={onDismiss} aria-label="Dismiss timer">
        ×
      </button>
    </div>
  );
}
