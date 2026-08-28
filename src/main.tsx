import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { I18nProvider } from './i18n';
import { loadDictionary } from './i18n/dictionaries';
import { detectInitialLanguage } from './i18n/storage';
import { loadCopy } from './seo/content';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Entry point.
 */

const initMobile = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await SplashScreen.hide();
      const isDark = document.documentElement.classList.contains('dark');
      await StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light,
      });
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: isDark ? '#080d18' : '#f6f8fb' });
      }
    } catch (e) {
      console.warn('Capacitor plugin initialization failed', e);
    }
  }
};

void initMobile();

/**
 * A stale chunk reference survives a deploy in an open tab: the HTML it has
 * points at hashed files that no longer exist. Reloading once fixes it; the
 * sessionStorage flag is what stops a permanently broken deploy from turning
 * that into a reload loop.
 *
 * Registered before the first render, because the dynamic imports below are
 * exactly the kind of request that fails this way.
 */
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

/**
 * The visitor's dictionary and SEO copy are fetched before the first render,
 * not during it.
 *
 * Uzbek resolves instantly — it is in the entry chunk — so the common case
 * pays nothing. A Russian or English visitor waits for one small chunk, which
 * is the same wait they used to pay inside the entry bundle, except now every
 * Uzbek visitor is not paying it too. Awaiting here rather than rendering and
 * patching afterwards is what keeps them from seeing a flash of Uzbek.
 */
const language = detectInitialLanguage();

void Promise.all([loadDictionary(language), loadCopy(language)]).then(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
});
