/**
 * i18n runtime.
 *
 * Deliberately dependency-free: the app needs a dictionary, an interpolator,
 * a persisted choice and a formatter. A library would add a bundle for
 * features (lazy namespaces, ICU plurals across dozens of locales) that three
 * closely-related locales do not need.
 *
 * Usage:
 *     const { t, language, setLanguage } = useTranslation();
 *     t('auth.login.title')
 *     t('listings.page.resultCount', { count: 42 })
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAppStore } from '../stores/useAppStore';
import { en } from './locales/en';
import { ru } from './locales/ru';
import { uz, type Dictionary, type UzDictionary } from './locales/uz';
import { detectInitialLanguage, persistLanguage } from './storage';
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_META,
  type DotKeys,
  type Language,
  type TranslationParams,
} from './types';

export type TranslationKey = DotKeys<UzDictionary>;

const DICTIONARIES: Record<Language, Dictionary> = { uz, ru, en };

// ---------------------------------------------------------------------------
// Lookup + interpolation
// ---------------------------------------------------------------------------
function resolve(dictionary: unknown, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
      dictionary,
    );
  return typeof value === 'string' ? value : undefined;
}

/** Replaces `{name}` placeholders; unknown placeholders are left visible so a
 *  missing parameter shows up in review instead of rendering as an empty gap. */
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export function translate(
  language: Language,
  key: string,
  params?: TranslationParams,
): string {
  const template =
    resolve(DICTIONARIES[language], key) ??
    // Fall back to Uzbek rather than rendering the raw key at the user.
    resolve(DICTIONARIES[DEFAULT_LANGUAGE], key);

  if (template === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing translation key: "${key}"`);
    }
    return key;
  }
  return interpolate(template, params);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /** Escape hatch for keys assembled at runtime (e.g. from a server code). */
  tRaw: (key: string, params?: TranslationParams) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPrice: (value: number, currency?: 'UZS' | 'USD') => string;
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (value: string | number | Date) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  // Keep <html lang> in sync: it drives screen-reader pronunciation, browser
  // translation prompts and CSS `:lang()` rules.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    persistLanguage(next);
  }, []);

  // The store holds the account's saved preference but cannot re-render the
  // tree on its own; registering the setter lets it drive the live UI.
  useEffect(() => {
    useAppStore.getState().registerLanguageApplier(setLanguage);
  }, [setLanguage]);

  const value = useMemo<I18nContextValue>(() => {
    const locale = LANGUAGE_META[language].locale;

    const formatNumber = (input: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(input);

    return {
      language,
      locale,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      tRaw: (key, params) => translate(language, key, params),
      formatNumber,
      formatPrice: (input, currency = 'UZS') => {
        if (currency === 'USD') {
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format(input);
        }
        // UZS has no widely-recognised symbol; the localised word reads better.
        return `${formatNumber(Math.round(input))} ${translate(language, 'common.units.som')}`;
      },
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(
          input instanceof Date ? input : new Date(input),
        ),
      formatRelativeTime: (input) => {
        const date = input instanceof Date ? input : new Date(input);
        const seconds = Math.round((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return translate(language, 'common.time.justNow');
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) {
          return translate(language, 'common.time.minutesAgo', { count: minutes });
        }
        const hours = Math.round(minutes / 60);
        if (hours < 24) return translate(language, 'common.time.hoursAgo', { count: hours });
        const days = Math.round(hours / 24);
        if (days === 1) return translate(language, 'common.time.yesterday');
        if (days < 30) return translate(language, 'common.time.daysAgo', { count: days });
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
      },
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used inside <I18nProvider>');
  }
  return context;
}

/** Read the current language outside React (API headers, for example). */
export function getStoredLanguage(): Language {
  return detectInitialLanguage();
}

export { detectInitialLanguage, persistLanguage } from './storage';

export { LANGUAGE_LIST, LANGUAGE_META, LANGUAGES } from './types';
export type { Language } from './types';
