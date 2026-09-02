/**
 * Labels for the SCREAMING_CASE enums the backend sends.
 *
 * next-intl throws on a missing key rather than rendering a blank, so no screen
 * may hand `t()` a value straight off the wire. Every screen guarded that with
 * its own `new Set([...])` of the values it knew about and fell back to the raw
 * value — which is how an AGENT account came to be listed as the literal string
 * "AGENT" in the users table, its role filter and the moderation sheet: the
 * role shipped on the backend before the catalogues had a word for it, and
 * three separate sets had to be found and edited before anyone noticed.
 *
 * Asking the catalogue with `has()` removes the sets: a value gains its real
 * label the moment a translation exists, and until then it reads as a word
 * rather than as an enum.
 */

/**
 * The part of a `useTranslations()` translator this file needs. Messages are
 * not type-augmented in this app, so its keys are plain strings.
 */
interface EnumTranslator {
  (key: string): string;
  has(key: string): boolean;
}

/**
 * A wire value with no translation, made readable: 'AGENT' → 'Agent',
 * 'REGISTRATION_REQUIRED' → 'Registration required'.
 *
 * It is not a translation and does not pretend to be one — it is what a
 * moderator sees for the ONE release between a backend enum growing a value and
 * the messages catching up, in place of a raw enum that reads as a bug.
 */
export function humaniseEnum(value: string): string {
  const words = value.trim().replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Keys already reported, so a 24-row table warns once instead of once per row
 * per render and the message stays readable in the console.
 */
const reported = new Set<string>();

/**
 * Build the label function for one enum: `enumLabeller(t, 'role', USER_ROLES)`
 * returns `t('role.AGENT')` when that message exists and 'Agent' when it does
 * not.
 *
 * `known` is the closed list this build ships — the same array that fills the
 * dropdowns. It separates the two reasons a message can be missing, which look
 * identical at the call site and are not the same thing at all:
 *
 * - a value NOT in `known` is one the backend grew after this build was cut.
 *   No catalogue could have covered it, humanising it is exactly what should
 *   happen, and it stays silent.
 * - a value that IS in `known` is a translation this build owes and does not
 *   have. It renders an English word into a Russian or an Uzbek panel and
 *   never fails, so nothing would ever surface it: before `has()` guarded
 *   these calls, next-intl made that loud by throwing. The dev-only warning is
 *   what replaces the throw, so a gap is found while writing the screen rather
 *   than by a moderator reading the wrong language.
 *
 * Omit `known` only where the caller genuinely has no closed list to check
 * against — an audit action, say, which is free-form on the wire.
 */
export function enumLabeller(
  t: EnumTranslator,
  prefix: string,
  known?: readonly string[],
): (value: string) => string {
  const catalogue = known ? new Set<string>(known) : null;
  return (value) => {
    const key = `${prefix}.${value}`;
    if (t.has(key)) return t(key);

    if (process.env.NODE_ENV !== 'production' && catalogue?.has(value) && !reported.has(key)) {
      reported.add(key);
      console.warn(
        `[enum-label] No message for "${key}", a value this build already ` +
          `knows about — add it to every file in src/messages. Falling back ` +
          `to "${humaniseEnum(value)}", which is English in every locale.`,
      );
    }
    return humaniseEnum(value);
  };
}
