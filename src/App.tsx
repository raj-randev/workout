import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { getAuthState, login, logout } from './auth';
import { LoginScreen } from './components/LoginScreen';
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

  function handleLogin(username: string, password: string) {
    const errorMessage = login(username, password);
    if (!errorMessage) {
      setAuthState(getAuthState());
    }
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
    </div>
  );
}

export default App;
