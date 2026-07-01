import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { getAuthState, login, logout } from './auth';
import { LoginScreen } from './components/LoginScreen';
import { FormPage } from './pages/FormPage';
import { LogPage } from './pages/LogPage';
import { ProgressPage } from './pages/ProgressPage';
import { loadAppData, loadAppDataAsync, saveAppData } from './storage';
import { saveAppDataToCloud } from './cloudData';
import type { AppData } from './types';

const tabs = [
  { path: '/', label: 'Log' },
  { path: '/progress', label: 'Progress' },
  { path: '/form', label: 'Form' },
];

function App() {
  const [authState, setAuthState] = useState(getAuthState);
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const [syncMessage, setSyncMessage] = useState<string | null>('Data is stored locally in this browser. Use Export data to move it to another device.');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAuthState(getAuthState());
    void loadAppDataAsync().then(({ data, source }) => {
      setAppData(data);
      setSyncMessage(source === 'cloud' ? '✓ Cloud data synced' : 'Data stored locally. Use Export/Import to move data between devices.');
    });
  }, []);

  useEffect(() => {
    if (!syncMessage) return;
    const timeout = window.setTimeout(() => setSyncMessage(null), 4000);
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

  function handleTestCloudSync() {
    console.log('[UI] Testing cloud sync...');
    void saveAppDataToCloud(appData).then(() => {
      setSyncMessage('✓ Cloud sync test successful!');
      console.log('[UI] Cloud sync test succeeded');
    }).catch((error) => {
      setSyncMessage(`✗ Cloud sync failed: ${error}`);
      console.error('[UI] Cloud sync test failed:', error);
    });
  }

  function handleExportData() {
    const payload = JSON.stringify(loadAppData(), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lift-log-data.json';
    link.click();
    window.URL.revokeObjectURL(url);
    setSyncMessage('Backup downloaded. Import it on another device to transfer your data.');
  }

  async function handleImportData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (!parsed || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.custom)) {
        throw new Error('That backup file is not valid.');
      }

      const nextData: AppData = {
        sessions: parsed.sessions,
        custom: parsed.custom,
      };

      setAppData(nextData);
      saveAppData(nextData);
      setSyncMessage('Backup imported. Your data is now available on this device.');
    } catch {
      setSyncMessage('That backup file could not be imported.');
    } finally {
      event.target.value = '';
    }
  }

  if (!authState.isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Lift Log</p>
          <h1>Strength training workbook</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="button-pill" onClick={handleTestCloudSync}>
            Test Cloud Sync
          </button>
          <button type="button" className="button-pill" onClick={handleExportData}>
            Export data
          </button>
          <button type="button" className="button-pill" onClick={() => fileInputRef.current?.click()}>
            Import data
          </button>
          <button type="button" className="button-pill" onClick={handleLogout}>
            Logout · {authState.username || 'Athlete'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportData} style={{ display: 'none' }} />
        </div>
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
