import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

const updateServiceWorker = registerSW({
  onOfflineReady() {
    console.log('PWA ready for offline use.');
  },
  onNeedRefresh() {
    console.log('New content is available.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// optional hook for future UI update prompt
export { updateServiceWorker };
