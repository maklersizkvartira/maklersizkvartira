import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

const handleChunkError = (message: string) => {
  if (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('non-JavaScript MIME type') ||
    message.includes('dynamically imported module')
  ) {
    if (!sessionStorage.getItem('chunk-load-reload')) {
      sessionStorage.setItem('chunk-load-reload', 'true');
      window.location.reload();
    }
  }
};

window.addEventListener('error', (e) => {
  if (e.message) handleChunkError(e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message) handleChunkError(e.reason.message);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
