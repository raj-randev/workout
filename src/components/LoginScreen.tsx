import { useState } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => boolean;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ok = onLogin(username, password);
    if (!ok) {
      setError('Please enter a name and passcode to continue.');
      return;
    }
    setError(null);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <p className="eyebrow">Lift Log</p>
        <h1>Welcome back</h1>
        <p className="login-copy">Use a simple local passcode to open your training journal.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Name
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. Raj"
            />
          </label>
          <label>
            Passcode
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter any passcode"
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="button-primary">
            Open dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
