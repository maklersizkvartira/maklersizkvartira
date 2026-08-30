/**
 * Theme handling.
 *
 * Three states, not two: 'light', 'dark', and 'system' (follow the OS). The
 * previous implementation toggled a class that no CSS consumed and had no
 * system option, so the control did nothing at all.
 *
 * The applied class is set on <html> before React paints (see the inline
 * bootstrap in index.html) so there is no white flash on a dark-mode load.
 *
 * That bootstrap reads `THEME_STORAGE_KEY` itself, in plain ES5, and has to
 * carry the same new-key-then-legacy-key fallback this file does. The two are
 * in different files and different languages; if they ever disagree the flash
 * is back, permanently, for every dark-mode visitor who chose the theme before
 * the rename.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { localStore } from '../lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'uyiz.theme';
/** What the key was called before the brand changed; migrated on first read. */
export const LEGACY_THEME_STORAGE_KEY = 'maklersiz.theme';

function readStoredPreference(): ThemePreference {
  const stored = localStore.read(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference;
}

function applyToDocument(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  // Tints the mobile browser chrome to match the page.
  //
  // `querySelectorAll`, not `querySelector`: index.html ships *two*
  // theme-color tags, one per `prefers-color-scheme`, so that a load with no
  // JavaScript still matches the OS. Writing to only the first one meant the
  // browser went on applying whichever of the pair its media query selected —
  // so on a dark-mode phone, choosing the light theme repainted the page and
  // left the address bar black, because the tag that was actually in effect
  // was the dark one this never touched.
  //
  // Once there is an explicit choice both tags carry the same colour, so
  // whichever one the media query picks is the right one.
  const color = theme === 'dark' ? '#080d18' : '#f6f8fb';
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', color));
}

interface ThemeContextValue {
  /** What the user chose, including 'system'. */
  preference: ThemePreference;
  /** What is actually rendered right now. */
  theme: ResolvedTheme;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Cycles light -> dark -> system. */
  cycle: () => void;
  /** Flips between light and dark, leaving 'system' behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(readStoredPreference()));

  useEffect(() => {
    const next = resolve(preference);
    setTheme(next);
    applyToDocument(next);
  }, [preference]);

  // While the preference is 'system', follow the OS switching live.
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const next: ResolvedTheme = event.matches ? 'dark' : 'light';
      setTheme(next);
      applyToDocument(next);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    localStore.write(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      theme,
      isDark: theme === 'dark',
      setPreference,
      cycle: () =>
        setPreference(
          preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light',
        ),
      toggle: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
    }),
    [preference, theme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return context;
}
