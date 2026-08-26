/**
 * Is this session a person, or a machine looking at the page?
 *
 * It matters because view counts feed the `POPULAR` sort. Once every listing
 * has its own URL — the whole point of the SEO work — Google's rendering pass
 * executes the detail page's effects on every one of them, and each render
 * would post a view. The default ranking would then reflect the order the
 * crawler happened to fetch things in, not what anybody actually looked at.
 *
 * Deliberately conservative: it only suppresses anonymous counters, never
 * anything the visitor asked for. A false positive costs one uncounted view.
 */

const AUTOMATED_AGENT =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|chrome-lighthouse|preview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|twitterbot|applebot|yandex|bingpreview/i;

export function isAutomatedAgent(): boolean {
  if (typeof navigator === 'undefined') return true;
  // Set by every WebDriver-controlled browser, including Puppeteer/Playwright.
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return true;
  return AUTOMATED_AGENT.test(navigator.userAgent || '');
}
