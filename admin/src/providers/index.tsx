'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { RoleProvider } from './role-provider';
import { Toaster } from '@/shared/ui/Toast';
// Locale-aware navigation. `useServerInsertedHTML` has no next-intl
// counterpart and stays on next/navigation; the router and the pathname must
// not, or a locale switch would push an unprefixed URL straight past the proxy.
import { useServerInsertedHTML } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/routing';
import { setApiLanguage } from '@/shared/lib/http';

// ─── Query Client ─────────────────────────────────────────────────────────────

/** Give up after this many attempts beyond the first. */
const MAX_RETRIES = 2;

/* The two readers below pull `ApiError`'s extra fields off structurally rather
   than importing the class. react-query types the rejection as `Error`, and a
   rejection that is NOT an ApiError (a bug in a queryFn, say) must still fall
   through these without throwing on a missing property. */

function httpStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

function retryAfterSeconds(error: unknown): number | undefined {
  const retryAfter = (error as { retryAfter?: unknown } | null)?.retryAfter;
  return typeof retryAfter === 'number' && retryAfter > 0 ? retryAfter : undefined;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        /**
         * Retry transport failures and 5xx; never retry a 4xx.
         *
         * A 4xx is the server saying the request itself is wrong — a bad
         * filter, a missing row, a rank the account does not hold — and
         * repeating it verbatim can only produce the same answer while adding
         * load. 429 is the exception: it means "not now", not "not ever", and
         * `retryDelay` honours the `retryAfter` the backend attached.
         *
         * `failureCount` counts attempts already made and so starts at 1, which
         * is why this compares with `<` rather than `<=`. The predicate it
         * replaces used `<=` against a per-role maximum and therefore granted
         * one more attempt than it advertised — four where it claimed three.
         * The role branch is gone too: rank decides what you may fetch, not how
         * hard the client should hammer a failing endpoint.
         */
        retry: (failureCount, error) => {
          const status = httpStatus(error);
          if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
            return false;
          }
          return failureCount < MAX_RETRIES;
        },
        retryDelay: (attemptIndex, error) => {
          // The backend tells us how long it wants on a 429; the global ceiling
          // is 240 requests per minute per IP, so guessing shorter just burns
          // another request against it.
          const retryAfter = retryAfterSeconds(error);
          if (retryAfter !== undefined) {
            return Math.min(retryAfter * 1000, 60_000);
          }
          return Math.min(1000 * 2 ** attemptIndex, 10000);
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ─── Theme Context ────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: (e?: React.MouseEvent) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function rehydrateThemePalette() {
  if (typeof window === 'undefined') return;
  try {
    const root = document.documentElement;
    // ── Theme (light/dark) ──
    const savedTheme = localStorage.getItem('theme') || 'dark';
    root.setAttribute('data-theme', savedTheme);

    // ── Accent Color Scheme ──
    // Third of three copies of this map — the other two are the pre-paint
    // script below and COLOR_SCHEMES in ThemePalette.tsx. All three must carry
    // the same hex per id, and `ocean` must match --accent in globals.css, or
    // the accent visibly changes between the pre-paint, the rehydrate and the
    // palette's own swatch. `ocean` is the Uyiz brand blue #1447e6.
    const SCHEMES: Record<string, { p: string; s: string; g: string }> = {
      ocean:   { p: '#1447e6', s: '#06b6d4', g: 'rgba(20,71,230,0.4)' },
      violet:  { p: '#7c3aed', s: '#a78bfa', g: 'rgba(124,58,237,0.4)' },
      emerald: { p: '#059669', s: '#34d399', g: 'rgba(5,150,105,0.4)' },
      rose:    { p: '#e11d48', s: '#fb7185', g: 'rgba(225,29,72,0.4)' },
      amber:   { p: '#d97706', s: '#fbbf24', g: 'rgba(217,119,6,0.4)' },
      slate:   { p: '#475569', s: '#94a3b8', g: 'rgba(71,85,105,0.4)' },
      pink:    { p: '#db2777', s: '#f472b6', g: 'rgba(219,39,119,0.4)' },
      teal:    { p: '#0f766e', s: '#2dd4bf', g: 'rgba(15,118,110,0.4)' },
      orange:  { p: '#ea580c', s: '#fb923c', g: 'rgba(234,88,12,0.4)' },
    };
    function adj(hex: string, amt: number) {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.min(255, Math.max(0, (n >> 16) + amt));
      const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
      const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    }
    const schemeId = localStorage.getItem('accent-scheme') || 'ocean';
    const sc = SCHEMES[schemeId] || SCHEMES.ocean;
    root.style.setProperty('--accent', sc.p);
    root.style.setProperty('--accent-light', adj(sc.p, 25));
    root.style.setProperty('--accent-dark', adj(sc.p, -25));
    root.style.setProperty('--accent-glow', sc.p + '4D');
    root.style.setProperty('--accent-subtle', sc.p + '12');
    root.style.setProperty('--accent-border', sc.p + '33');
    root.style.setProperty('--color-brand-500', sc.p);
    root.style.setProperty('--color-brand-600', adj(sc.p, -15));
    root.style.setProperty('--color-brand-400', adj(sc.p, 15));
    root.style.setProperty('--color-cyan-500', sc.s);
    root.style.setProperty('--color-cyan-400', adj(sc.s, 15));
    root.style.setProperty('--color-cyan-600', adj(sc.s, -15));
    root.style.setProperty('--gradient-brand', `linear-gradient(135deg, ${sc.p} 0%, ${sc.s} 100%)`);
    root.style.setProperty('--shadow-glow', `0 0 40px ${sc.g}, 0 0 80px ${sc.g.replace('0.4', '0.15')}`);
    root.style.setProperty('--color-info', sc.p);
    root.style.setProperty('--color-info-bg', sc.p + '12');
    root.style.setProperty('--color-info-border', sc.p + '33');

    // ── Font ──
    const FONTS: Record<string, string> = {
      inter: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      syne:  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono:  "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace",
    };
    const fontId = localStorage.getItem('ui-font') || 'inter';
    const fv = FONTS[fontId] || FONTS.inter;
    root.style.setProperty('--font-sans', fv);
    if (document.body) document.body.style.fontFamily = fv;

    // ── Radius ──
    const RADIUS_PRESETS: Record<string, { sm: string; md: string; lg: string; xl: string }> = {
      compact: { sm: '4px', md: '8px',  lg: '12px', xl: '16px' },
      default: { sm: '8px', md: '12px', lg: '16px', xl: '22px' },
      rounded: { sm: '12px',md: '18px', lg: '24px', xl: '32px' },
      pill:    { sm: '20px',md: '28px', lg: '36px', xl: '48px' },
    };
    const radiusId = localStorage.getItem('ui-radius') || 'default';
    const preset = RADIUS_PRESETS[radiusId] || RADIUS_PRESETS.default;
    root.style.setProperty('--radius-sm', preset.sm);
    root.style.setProperty('--radius-md', preset.md);
    root.style.setProperty('--radius-lg', preset.lg);
    root.style.setProperty('--radius-xl', preset.xl);

    // ── Background ──
    const bgType = localStorage.getItem('bg-type') as 'preset' | 'image' | null;
    if (bgType) {
      const bgBlur    = Number(localStorage.getItem('bg-blur')    || '0');
      const bgOverlay = Number(localStorage.getItem('bg-overlay') || '55');
      const bgNoise   = localStorage.getItem('bg-noise') === '1';

      const BG_PRESETS_CSS: Record<string, string> = {
        aurora: `radial-gradient(ellipse at 20% 50%, rgba(120,80,255,0.35) 0%, transparent 60%),radial-gradient(ellipse at 80% 20%, rgba(0,200,180,0.25) 0%, transparent 55%),radial-gradient(ellipse at 60% 80%, rgba(80,120,255,0.3) 0%, transparent 50%),linear-gradient(135deg,#0f0c29 0%,#1a1440 50%,#0d1a2e 100%)`,
        sunset: `radial-gradient(ellipse at 50% 100%, rgba(255,120,50,0.4) 0%, transparent 60%),radial-gradient(ellipse at 80% 60%, rgba(200,50,100,0.3) 0%, transparent 50%),radial-gradient(ellipse at 20% 40%, rgba(120,20,80,0.35) 0%, transparent 55%),linear-gradient(180deg,#0d0118 0%,#2d0a2e 35%,#7a1a35 70%,#c04020 100%)`,
        'ocean-deep': `radial-gradient(ellipse at 30% 30%, rgba(0,120,200,0.3) 0%, transparent 55%),radial-gradient(ellipse at 70% 70%, rgba(0,60,140,0.4) 0%, transparent 60%),radial-gradient(ellipse at 50% 0%, rgba(0,200,255,0.15) 0%, transparent 40%),linear-gradient(180deg,#000d1a 0%,#001428 40%,#002244 100%)`,
        forest: `radial-gradient(ellipse at 40% 60%, rgba(20,100,20,0.35) 0%, transparent 55%),radial-gradient(ellipse at 80% 20%, rgba(80,180,30,0.2) 0%, transparent 50%),radial-gradient(ellipse at 10% 80%, rgba(0,80,20,0.4) 0%, transparent 55%),linear-gradient(135deg,#050f05 0%,#0d200d 50%,#142814 100%)`,
        galaxy: `radial-gradient(ellipse at 50% 50%, rgba(100,50,200,0.2) 0%, transparent 60%),radial-gradient(ellipse at 20% 20%, rgba(200,100,255,0.15) 0%, transparent 40%),radial-gradient(ellipse at 80% 80%, rgba(50,100,255,0.2) 0%, transparent 45%),radial-gradient(ellipse at 60% 10%, rgba(255,200,100,0.08) 0%, transparent 30%),linear-gradient(135deg,#02000a 0%,#0a0018 50%,#050010 100%)`,
        'rose-gold': `radial-gradient(ellipse at 30% 40%, rgba(200,80,80,0.25) 0%, transparent 55%),radial-gradient(ellipse at 70% 60%, rgba(150,50,100,0.3) 0%, transparent 50%),radial-gradient(ellipse at 60% 20%, rgba(255,150,100,0.15) 0%, transparent 40%),linear-gradient(135deg,#0f0505 0%,#1f0808 45%,#2d0f0f 100%)`,
        'northern-lights': `radial-gradient(ellipse at 20% 50%, rgba(0,255,150,0.2) 0%, transparent 55%),radial-gradient(ellipse at 80% 30%, rgba(0,200,255,0.18) 0%, transparent 50%),radial-gradient(ellipse at 50% 80%, rgba(100,0,255,0.15) 0%, transparent 45%),radial-gradient(ellipse at 60% 10%, rgba(0,255,100,0.12) 0%, transparent 35%),linear-gradient(180deg,#000a05 0%,#001510 50%,#000d0a 100%)`,
      };

      // Clean up any legacy divs from prior implementation
      document.getElementById('__theme_bg_layer__')?.remove();
      document.getElementById('__theme_bg_overlay__')?.remove();

      // Set background directly on <html> element — always below all stacking contexts
      if (bgType === 'preset') {
        const presetId = localStorage.getItem('bg-preset') || '';
        const css = BG_PRESETS_CSS[presetId];
        if (css) {
          root.style.backgroundImage    = css.replace(/\s+/g, ' ').trim();
          root.style.backgroundSize     = 'cover';
          root.style.backgroundPosition = 'center';
          root.style.backgroundAttachment = 'fixed';
        }
      } else if (bgType === 'image') {
        const imageUrl = localStorage.getItem('bg-image');
        if (imageUrl) {
          root.style.backgroundImage    = `url(${imageUrl})`;
          root.style.backgroundSize     = 'cover';
          root.style.backgroundPosition = 'center';
          root.style.backgroundAttachment = 'fixed';
        }
      }

      // CSS custom properties drive body::before overlay (see globals.css)
      root.style.setProperty('--bg-overlay-opacity', String((bgOverlay / 100) * 0.52));
      root.style.setProperty('--bg-blur-px', bgBlur > 0 ? `${bgBlur}px` : '0px');

      root.setAttribute('data-has-bg', 'true');
      if (bgNoise) {
        root.setAttribute('data-bg-noise', 'true');
      } else {
        root.removeAttribute('data-bg-noise');
      }
    }
  } catch {
    // localStorage is unreachable (private mode, storage disabled). The page
    // keeps the CSS defaults from globals.css, which are the same brand values.
  }
}

function ThemeProvider({ children, pathname, locale }: { children: ReactNode; pathname: string; locale: string }) {
  // ✅ Default dark mode
  const [theme, setTheme] = useState<Theme>('dark');

  /* The chosen theme is written onto <html> by the pre-paint script, before
     React exists, precisely so the first paint is not the wrong colour. It can
     therefore only be READ after mount — reading it during render would make
     the client's first pass disagree with the server's, which is a hydration
     mismatch rather than a cascading-render problem. Same justification as the
     lock countdown in the login page. */
  /* eslint-disable react-hooks/set-state-in-effect -- see above */
  useEffect(() => {
    // Read from html element (set by inline script before hydration)
    const attr = document.documentElement.getAttribute('data-theme') as Theme | null;
    if (attr === 'light' || attr === 'dark') {
      setTheme(attr);
    } else {
      // Fallback: dark
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    }
    // ✅ Fully rehydrate theme palette (colors, fonts, radius) on load and locale/path switch
    rehydrateThemePalette();
  }, [pathname, locale]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ✅ Telegram-style ripple animation when toggling theme
  const toggleTheme = (e?: React.MouseEvent) => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';

    // If browser supports View Transitions API — use it for smooth ripple
    if (e && 'startViewTransition' in document) {
      const x = e.clientX;
      const y = e.clientY;
      const maxR = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(() => {
        document.documentElement.setAttribute('data-theme', next);
        setTheme(next);
        localStorage.setItem('theme', next);
      }).ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxR}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 400,
            easing: 'ease-in',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      });
    } else {
      // Fallback for browsers without View Transitions
      document.documentElement.setAttribute('data-theme', next);
      setTheme(next);
      localStorage.setItem('theme', next);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Language Context ─────────────────────────────────────────────────────────

type Locale = 'uz' | 'ru' | 'en';

const LOCALES: Locale[] = ['uz', 'ru', 'en'];

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'uz',
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

// ─── Root Providers ───────────────────────────────────────────────────────────

interface ProvidersProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

import { ConfirmProvider } from './confirm-provider';

/**
 * Everything that needs next-intl's navigation, which is everything below
 * `NextIntlClientProvider`.
 *
 * `useRouter` and `usePathname` from `@/i18n/routing` are locale-aware, and
 * they get the locale from next-intl's own context — so calling them in
 * `Providers`, the component that *renders* that context, throws on every
 * server render. The split is not cosmetic: it is what puts these hooks below
 * the provider they depend on.
 */
function IntlAwareProviders({
  children,
  currentLocale,
  setCurrentLocale,
}: {
  children: ReactNode;
  currentLocale: Locale;
  setCurrentLocale: (l: Locale) => void;
}) {
  const queryClient = getQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const handleSetLocale = (l: Locale) => {
    if (!LOCALES.includes(l)) return;
    setCurrentLocale(l);
    // `pathname` here is next-intl's locale-FREE pathname, and its router takes
    // the target locale as an option. The version this replaces spliced the
    // segment by hand off next/navigation's raw pathname, which meant every
    // string in this function had to stay in step with `localePrefix` — and it
    // also wrote NEXT_LOCALE, a cookie `i18n/request.ts` deliberately no longer
    // reads (the URL segment is the single source of truth for the bundle).
    router.replace(pathname, { locale: l });
  };

  return (
    <LocaleContext.Provider value={{ locale: currentLocale, setLocale: handleSetLocale }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider pathname={pathname} locale={currentLocale}>
          <RoleProvider>
            <ConfirmProvider>
              {children}
              <Toaster />
            </ConfirmProvider>
          </RoleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </LocaleContext.Provider>
  );
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  const [currentLocale, setCurrentLocale] = useState<Locale>(locale as Locale);

  // The API localises its error `message` from the X-Language header, so the
  // http client has to learn about a locale switch too — otherwise a Russian
  // admin keeps getting Uzbek validation errors. Browser only: the module cell
  // it writes to would be shared across requests during SSR.
  useEffect(() => {
    setApiLanguage(currentLocale);
  }, [currentLocale]);

  useServerInsertedHTML(() => {
    return (
      <script
        id="theme-initializer"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                // ── Theme (light/dark) ──────────────────────────────
                var saved = localStorage.getItem('theme');
                if (saved === 'light') {
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  if (!saved) localStorage.setItem('theme', 'dark');
                }

                // ── Accent color scheme ─────────────────────────────
                // Keep in step with rehydrateThemePalette() above and with
                // COLOR_SCHEMES in ThemePalette.tsx — 'ocean' is #1447e6.
                var SCHEMES = {
                  ocean:   { p: '#1447e6', s: '#06b6d4', g: 'rgba(20,71,230,0.4)' },
                  violet:  { p: '#7c3aed', s: '#a78bfa', g: 'rgba(124,58,237,0.4)' },
                  emerald: { p: '#059669', s: '#34d399', g: 'rgba(5,150,105,0.4)' },
                  rose:    { p: '#e11d48', s: '#fb7185', g: 'rgba(225,29,72,0.4)' },
                  amber:   { p: '#d97706', s: '#fbbf24', g: 'rgba(217,119,6,0.4)' },
                  slate:   { p: '#475569', s: '#94a3b8', g: 'rgba(71,85,105,0.4)' },
                  pink:    { p: '#db2777', s: '#f472b6', g: 'rgba(219,39,119,0.4)' },
                  teal:    { p: '#0f766e', s: '#2dd4bf', g: 'rgba(15,118,110,0.4)' },
                  orange:  { p: '#ea580c', s: '#fb923c', g: 'rgba(234,88,12,0.4)' },
                };
                function adj(hex, amt) {
                  var n = parseInt(hex.slice(1), 16);
                  var r = Math.min(255, Math.max(0, (n >> 16) + amt));
                  var g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
                  var b = Math.min(255, Math.max(0, (n & 0xff) + amt));
                  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
                }
                var schemeId = localStorage.getItem('accent-scheme') || 'ocean';
                var sc = SCHEMES[schemeId] || SCHEMES.ocean;
                var root = document.documentElement;
                root.style.setProperty('--accent', sc.p);
                root.style.setProperty('--accent-light', adj(sc.p, 25));
                root.style.setProperty('--accent-dark', adj(sc.p, -25));
                root.style.setProperty('--accent-glow', sc.p + '4D');
                root.style.setProperty('--accent-subtle', sc.p + '12');
                root.style.setProperty('--accent-border', sc.p + '33');
                root.style.setProperty('--color-brand-500', sc.p);
                root.style.setProperty('--color-brand-600', adj(sc.p, -15));
                root.style.setProperty('--color-brand-400', adj(sc.p, 15));
                root.style.setProperty('--color-cyan-500', sc.s);
                root.style.setProperty('--color-cyan-400', adj(sc.s, 15));
                root.style.setProperty('--color-cyan-600', adj(sc.s, -15));
                root.style.setProperty('--gradient-brand', 'linear-gradient(135deg,' + sc.p + ' 0%,' + sc.s + ' 100%)');
                root.style.setProperty('--shadow-glow', '0 0 40px ' + sc.g + ', 0 0 80px ' + sc.g.replace('0.4', '0.15'));
                root.style.setProperty('--color-info', sc.p);
                root.style.setProperty('--color-info-bg', sc.p + '12');
                root.style.setProperty('--color-info-border', sc.p + '33');

                // ── Font ────────────────────────────────────────────
                var FONTS = {
                  inter: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  syne:  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  mono:  "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace",
                };
                var fontId = localStorage.getItem('ui-font') || 'inter';
                var fv = FONTS[fontId] || FONTS.inter;
                root.style.setProperty('--font-sans', fv);
                document.body && (document.body.style.fontFamily = fv);

                // ── Radius ──────────────────────────────────────────
                var RADIUS = {
                  compact: { sm: '4px', md: '8px',  lg: '12px', xl: '16px' },
                  default: { sm: '8px', md: '12px', lg: '16px', xl: '22px' },
                  rounded: { sm: '12px',md: '18px', lg: '24px', xl: '32px' },
                  pill:    { sm: '20px',md: '28px', lg: '36px', xl: '48px' },
                };
                var radiusId = localStorage.getItem('ui-radius') || 'default';
                var preset = RADIUS[radiusId] || RADIUS.default;
                root.style.setProperty('--radius-sm', preset.sm);
                root.style.setProperty('--radius-md', preset.md);
                root.style.setProperty('--radius-lg', preset.lg);
                root.style.setProperty('--radius-xl', preset.xl);
              } catch (e) {}
            })();
          `,
        }}
      />
    );
  });

  return (
    <NextIntlClientProvider locale={currentLocale} messages={messages}>
      <IntlAwareProviders
        currentLocale={currentLocale}
        setCurrentLocale={setCurrentLocale}
      >
        {children}
      </IntlAwareProviders>
    </NextIntlClientProvider>
  );
}
