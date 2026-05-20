import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear any previously recorded reload state on successful boot
sessionStorage.removeItem('vite-preload-error-reloaded');

// Handle dynamic import failures (often occurs when new versions are deployed)
window.addEventListener('vite:preloadError', (event) => {
  const isReloaded = sessionStorage.getItem('vite-preload-error-reloaded');
  if (!isReloaded) {
    sessionStorage.setItem('vite-preload-error-reloaded', 'true');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
