/**
 * Display helpers for values that should not be read over someone's shoulder.
 *
 * The phone helpers mirror `backend_python/app/core/phone.py` exactly. That
 * matters because audit rows arrive with their phone numbers already masked by
 * the backend — a screen that formats them a second, different way makes two
 * renderings of the same number look like two different numbers.
 */

/** Digits only, country code included. */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Mask a secret for display, e.g. `****abcd`. */
export function maskSecret(value?: string | null, visibleTail = 4): string {
  if (!value) return 'Not configured';
  if (value.length <= visibleTail) return '****';
  return `****${value.slice(-visibleTail)}`;
}

/** `+998901234567` → `+998 90 *** ** 67`, the same shape the backend logs. */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = digitsOf(phone);
  if (digits.length < 6) return '***';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} *** ** ${digits.slice(-2)}`;
}

/**
 * `+998901234567` → `+998 90 123 45 67`, for the screens that are allowed to
 * show the whole number. Anything that is not a full Uzbek number is returned
 * untouched rather than sliced into a shape it does not have.
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = digitsOf(phone);
  if (digits.length !== 12) return phone;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}

/**
 * Shorten a uuid to its first segment for a table cell — `3f2a1b4c`. The full
 * value belongs in a `title` attribute or a copy button, never truncated in a
 * place someone might read it as complete.
 */
export function shortId(id?: string | null): string {
  if (!id) return '';
  return id.split('-')[0] ?? id.slice(0, 8);
}
