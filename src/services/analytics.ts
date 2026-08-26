/**
 * Google Analytics 4, off unless a measurement id is configured.
 *
 * Three deliberate properties:
 *
 *  - **Opt-in by configuration.** With `VITE_GA_MEASUREMENT_ID` unset nothing
 *    is fetched, no global is defined and no cookie is written. A build
 *    without the variable behaves exactly as it did before this file existed.
 *  - **Never on the critical path.** The tag is loaded after the page is idle,
 *    so it cannot compete with the first render for bandwidth or main-thread
 *    time. Analytics that costs you LCP costs you the ranking it was meant to
 *    measure.
 *  - **No crawler traffic.** Search-engine renderers would otherwise show up
 *    as a wave of sessions with a 100% bounce rate and wreck the numbers the
 *    SEO work is judged by.
 *
 * Consent is a decision for whoever runs the site: EU visitors need a lawful
 * basis before this is switched on. `setAnalyticsConsent(false)` disables it
 * at runtime, and the id can simply be left unset.
 */

import { isAutomatedAgent } from './crawler';

type GtagArgs = [string, ...unknown[]];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let started = false;
let consented = true;

export const isAnalyticsConfigured = Boolean(MEASUREMENT_ID);

export function setAnalyticsConsent(granted: boolean): void {
  consented = granted;
  if (granted) startAnalytics();
}

function shouldRun(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(MEASUREMENT_ID) &&
    consented &&
    !isAutomatedAgent()
  );
}

/** Runs `fn` when the browser is idle, or soon after load as a fallback. */
function whenIdle(fn: () => void): void {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (idle) idle(fn);
  else window.setTimeout(fn, 2000);
}

export function startAnalytics(): void {
  if (started || !shouldRun()) return;
  started = true;

  whenIdle(() => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: GtagArgs) {
      window.dataLayer!.push(args);
    };
    window.gtag('js', new Date());
    // Page views are sent explicitly on navigation instead, because this is a
    // single-page app: the automatic pageview would only ever fire once.
    window.gtag('config', MEASUREMENT_ID!, {
      send_page_view: false,
      anonymize_ip: true,
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID!)}`;
    document.head.appendChild(script);
  });
}

export function trackPageView(path: string, title: string): void {
  if (!shouldRun()) return;
  startAnalytics();
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: `${window.location.origin}${path}`,
  });
}

/**
 * The events worth watching alongside organic traffic.
 *
 * `contact_reveal` is the one that matters: it is the moment a search visitor
 * becomes a lead, and it is the only honest way to tell a landing page that
 * ranks from a landing page that works.
 */
export type AnalyticsEvent =
  | 'listing_view'
  | 'contact_reveal'
  | 'listing_favorite'
  | 'listing_publish'
  | 'search_submit'
  | 'filter_apply'
  | 'language_switch';

export function trackEvent(
  name: AnalyticsEvent,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!shouldRun()) return;
  startAnalytics();
  window.gtag?.('event', name, params);
}
