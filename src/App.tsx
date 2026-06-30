import { NavLink, Route, Routes } from 'react-router-dom';
import { FormPage } from './pages/FormPage';
import { LogPage } from './pages/LogPage';
import { ProgressPage } from './pages/ProgressPage';

const tabs = [
  { path: '/', label: 'Log' },
  { path: '/progress', label: 'Progress' },
  { path: '/form', label: 'Form' },
];

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Lift Log</p>
          <h1>Strength training workbook</h1>
        </div>
      </header>
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
