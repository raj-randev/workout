import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { getAuthState, login, logout } from './auth';
import { LoginScreen } from './components/LoginScreen';
import { RestTimer } from './components/RestTimer';
import type { TimerContext } from './components/RestTimer';
import { FormPage } from './pages/FormPage';
import { LogPage } from './pages/LogPage';
import { ProgressPage } from './pages/ProgressPage';
import { loadAppDataAsync } from './storage';
import type { AppData } from './types';

const tabs = [
  { path: '/', label: 'Log' },
  { path: '/progress', label: 'Progress' },
  { path: '/form', label: 'Form' },
];

function App() {
  const [authState, setAuthState] = useState(getAuthState);
  const [appData, setAppData] = useState<AppData>({ sessions: [], custom: [] });
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<{ seconds: number; total: number } | null>(null);
  const [setRestDuration, setSetRestDuration] = useState(60);
  const [exerciseRestDuration, setExerciseRestDuration] = useState(90);
  const [restContext, setRestContext] = useState<TimerContext | null>(null);

  useEffect(() => {
    setAuthState(getAuthState());
    void loadAppDataAsync().then(({ data, source }) => {
      setAppData(data);
      if (source === 'cloud') setSyncMessage('✓ Synced');
    });
  }, []);

  useEffect(() => {
    if (!syncMessage) return;
    const timeout = window.setTimeout(() => setSyncMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [syncMessage]);

  // Tick the rest timer
  useEffect(() => {
    if (!restTimer || restTimer.seconds <= 0) return;
    const id = window.setTimeout(() => {
      setRestTimer((prev) => prev ? { ...prev, seconds: prev.seconds - 1 } : null);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [restTimer]);

  // When timer hits 0: notification + signal LogPage to scroll
  useEffect(() => {
    if (restTimer?.seconds !== 0) return;
    if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification('Rest done!', {
        body: restContext?.nextExercise
          ? `Next up: ${restContext.nextExercise}`
          : 'Time for your next set.',
        silent: false,
      });
    }
    if (restContext?.isLastSet) {
      window.dispatchEvent(new CustomEvent('rest-timer-done', {
        detail: { nextExercise: restContext.nextExercise },
      }));
    }
  }, [restTimer?.seconds, restContext]);

  // Listen for timer start from LogPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Partial<TimerContext>>).detail ?? {};
      if (Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      const ctx: TimerContext | null = detail.exercise ? {
        exercise: detail.exercise,
        isLastSet: detail.isLastSet ?? false,
        nextExercise: detail.nextExercise,
      } : null;
      setRestContext(ctx);
      const isBetweenSets = ctx ? !ctx.isLastSet : false;
      const duration = isBetweenSets ? setRestDuration : exerciseRestDuration;
      setRestTimer({ seconds: duration, total: duration });
    };
    window.addEventListener('rest-timer-start', handler);
    return () => window.removeEventListener('rest-timer-start', handler);
  }, [setRestDuration, exerciseRestDuration]);

  function handleLogin(username: string, password: string) {
    const errorMessage = login(username, password);
    if (!errorMessage) setAuthState(getAuthState());
    return errorMessage;
  }

  function handleLogout() {
    logout();
    setAuthState(getAuthState());
  }

  if (!authState.isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow app-eyebrow">Lift Log</p>
          <h1>Strength training workbook</h1>
        </div>
        <button type="button" className="button-pill" onClick={handleLogout}>
          Logout
        </button>
      </header>
      {syncMessage && <div className="sync-banner">{syncMessage}</div>}
      <nav className="tab-bar">
        {tabs.map((tab) => (
          <NavLink key={tab.path} to={tab.path} className={({ isActive }) => isActive ? 'tab active' : 'tab'} end={tab.path === '/'}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<LogPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/form" element={<FormPage />} />
        </Routes>
      </main>
      {restTimer && (
        <RestTimer
          seconds={restTimer.seconds}
          total={restTimer.total}
          context={restContext}
          onStart={(d) => {
            const isBetweenSets = restContext ? !restContext.isLastSet : false;
            if (isBetweenSets) setSetRestDuration(d); else setExerciseRestDuration(d);
            setRestTimer({ seconds: d, total: d });
          }}
          onDismiss={() => { setRestTimer(null); setRestContext(null); }}
        />
      )}
    </div>
  );
}

export default App;
