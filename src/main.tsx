import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { I18nProvider } from './i18n';
import { loadDictionary } from './i18n/dictionaries';
import { detectInitialLanguage } from './i18n/storage';
import { loadCopy } from './seo/content';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

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
        <I18nProvider initialLanguage={language}>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
});
