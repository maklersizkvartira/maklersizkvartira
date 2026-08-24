/**
 * i18n types.
 *
 * Uzbek is the source of truth: every other locale is type-checked against
 * its shape, so a missing or misspelled Russian key is a compile error rather
 * than a string that silently falls back at runtime.
 */

export const LANGUAGES = ['uz', 'ru', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'uz';

export interface LanguageMeta {
  code: Language;
  /** How speakers of the language name it. */
  nativeName: string;
  englishName: string;
  flag: string;
  /** Intl locale used for number, date and currency formatting. */
  locale: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  uz: { code: 'uz', nativeName: "O'zbekcha", englishName: 'Uzbek', flag: '🇺🇿', locale: 'uz-UZ' },
  ru: { code: 'ru', nativeName: 'Русский', englishName: 'Russian', flag: '🇷🇺', locale: 'ru-RU' },
  en: { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇬🇧', locale: 'en-US' },
};

export const LANGUAGE_LIST: LanguageMeta[] = LANGUAGES.map((code) => LANGUAGE_META[code]);

/** A leaf is a plain string; a branch nests further. */
export type TranslationNode = string | { [key: string]: TranslationNode };

export type TranslationTree = Record<string, TranslationNode>;

/**
 * Every dotted path through a dictionary that ends at a string.
 *
 * `DotKeys<{a: {b: string}}>` is `"a.b"`, so `t('a.b')` type-checks and
 * `t('a.c')` does not.
 */
export type DotKeys<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotKeys<T[K]>}`;
    }[keyof T & string];

/** Values interpolated into `{placeholders}`. */
export type TranslationParams = Record<string, string | number | undefined | null>;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
