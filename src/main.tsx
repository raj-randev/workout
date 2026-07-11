import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Reload when a new service worker takes control so fresh assets are used.
// This is especially important on iOS Safari PWA which won't auto-reload.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

const updateServiceWorker = registerSW({
  onOfflineReady() {},
  onNeedRefresh() {
    // Immediately apply the waiting service worker and reload.
    void updateServiceWorker(true);
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
