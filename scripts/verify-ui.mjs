/**
 * Smoke-checks the built app in a real browser.
 *
 * Confirms the page actually renders (rather than white-screening), that both
 * themes paint, that all three languages switch, and that nothing throws.
 *
 *   npm run build
 *   npm run preview            # in one terminal
 *   npm run backend:dev        # in another
 *   node scripts/verify-ui.mjs
 *
 * Requires playwright: npx playwright install chromium
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = 'ui-verification';
mkdirSync(OUT, { recursive: true });

const problems = [];
const browser = await chromium.launch();

async function newPage(theme, language) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      // A failed favicon or a missing demo image is not an app defect.
      if (/favicon|logo\.png|ERR_(NAME|CONNECTION)|example\.uz/i.test(text)) return;
      problems.push(`[console:${theme}/${language}] ${text.slice(0, 180)}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`[pageerror:${theme}/${language}] ${String(error).slice(0, 200)}`);
  });

  // Both key generations are seeded on purpose. The app reads `uyiz.*` and
  // falls back to the old `maklersiz.*` key once, migrating it — so a build
  // from either side of the rename is driven correctly by this script. Seeding
  // only one would make the other silently test the default theme and language
  // and fail all four assertions below for the wrong reason. Drop the old pair
  // when the migration shim is removed.
  await page.addInitScript(([t, l]) => {
    localStorage.setItem('uyiz.theme', t);
    localStorage.setItem('uyiz.language', l);
    localStorage.setItem('maklersiz.theme', t);
    localStorage.setItem('maklersiz.language', l);
  }, [theme, language]);

  return { context, page };
}

const checks = [
  ['light', 'uz'],
  ['dark', 'uz'],
  ['light', 'ru'],
  ['dark', 'en'],
];

for (const [theme, language] of checks) {
  const { context, page } = await newPage(theme, language);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => {
    const body = document.body;
    const root = document.getElementById('root');
    const styles = getComputedStyle(body);
    return {
      htmlLang: document.documentElement.lang,
      isDark: document.documentElement.classList.contains('dark'),
      bg: styles.backgroundColor,
      color: styles.color,
      renderedNodes: root ? root.querySelectorAll('*').length : 0,
      headingText: document.querySelector('h1')?.textContent?.trim().slice(0, 70) ?? null,
      navLabels: [...document.querySelectorAll('header nav button')]
        .map((b) => b.textContent.trim()).filter(Boolean).slice(0, 5),
      // A key that failed to resolve renders as its own dotted path.
      untranslatedKeys: (document.body.innerText.match(/\b[a-z]+\.[a-z]+\.[a-zA-Z.]+\b/g) || [])
        .filter((s) => /^(common|layout|auth|listings|home|owner|account)\./.test(s))
        .slice(0, 5),
    };
  });

  const label = `${theme}-${language}`;
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });

  if (info.renderedNodes < 50) problems.push(`[render:${label}] only ${info.renderedNodes} nodes — likely blank`);
  if (info.isDark !== (theme === 'dark')) problems.push(`[theme:${label}] .dark class = ${info.isDark}`);
  if (info.htmlLang !== language) problems.push(`[lang:${label}] <html lang> = ${info.htmlLang}`);
  if (info.untranslatedKeys.length) problems.push(`[i18n:${label}] raw keys visible: ${info.untranslatedKeys.join(', ')}`);

  console.log(`${label.padEnd(10)} nodes=${String(info.renderedNodes).padStart(4)}  bg=${info.bg.padEnd(18)} lang=${info.htmlLang}  dark=${info.isDark}`);
  console.log(`           h1: ${info.headingText}`);
  console.log(`           nav: ${info.navLabels.join(' | ')}`);

  await context.close();
}

// The auth dialog is the flow that was specifically requested — open it.
{
  const { context, page } = await newPage('dark', 'uz');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
  const signUp = page.locator('header button', { hasText: /E.lon berish|Kirish/ }).first();
  if (await signUp.count()) {
    await signUp.click();
    await page.waitForTimeout(700);
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count()) {
      await page.screenshot({ path: `${OUT}/auth-dialog.png` });
      const fields = await dialog.locator('input').count();
      console.log(`auth       dialog opened, ${fields} input(s)`);
    } else {
      problems.push('[auth] dialog did not open');
    }
  }
  await context.close();
}

await browser.close();

console.log('\n' + '─'.repeat(64));
if (problems.length === 0) {
  console.log('UI VERIFICATION: no problems found');
} else {
  console.log(`UI VERIFICATION: ${problems.length} problem(s)`);
  problems.forEach((p) => console.log('  ' + p));
}
console.log(`screenshots in ${OUT}/`);
