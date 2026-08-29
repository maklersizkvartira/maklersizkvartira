/**
 * Language switcher.
 *
 * Two shapes for one control.
 *
 * `inline` is a segmented radiogroup — the whole choice on screen at once. It
 * is what the header's settings popover and the mobile drawer both use, and
 * it exists because the alternative was a menu nested inside a popover and a
 * menu nested inside a sheet: two dismissable layers stacked on each other,
 * each with its own outside-click handler, competing for the same Escape
 * press. A radiogroup has no second layer to dismiss. It also matches
 * ThemeToggle's full control pixel for pixel, so the two settings a visitor
 * meets side by side look like one pair rather than two unrelated widgets.
 *
 * The default shape is still a menu rather than a cycling button: with three
 * languages a cycle makes a user press twice to go back one, and never shows
 * what the options are.
 *
 * The `inverted` variant is gone. It painted this button in the header's old
 * white-on-blue chip skin — a string hand-copied from Header.tsx and
 * ThemeToggle.tsx — and the bar no longer carries a language chip at all.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';

import { LANGUAGE_LIST, useTranslation, type Language } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';

export const LanguageSwitcher: React.FC<{ compact?: boolean; inline?: boolean }> = ({
  compact = false,
  inline = false,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const setStoreLanguage = useAppStore((state) => state.setLanguage);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const choose = (next: Language) => {
    // One call, not two: since the provider stopped holding its own copy of
    // the language, `setLanguage` from the context IS the store's setter, and
    // calling both sent two profile-update requests per switch.
    setStoreLanguage(next);
    setOpen(false);
  };

  const active = LANGUAGE_LIST.find((entry) => entry.code === language);

  if (inline) {
    return (
      <div
        role="radiogroup"
        aria-label={t('common.a11y.selectLanguage')}
        className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1"
      >
        {LANGUAGE_LIST.map((entry) => (
          <button
            key={entry.code}
            type="button"
            role="radio"
            aria-checked={entry.code === language}
            onClick={() => choose(entry.code)}
            className={`press flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors ${
              entry.code === language
                ? 'bg-surface text-content shadow-card'
                : 'text-muted hover:text-content'
            }`}
          >
            {/* The visible label is the flag and the two-letter code: three
                native names ("O‘zbekcha", "Русский", "English") do not fit
                across a 224px popover at a legible size, and truncating a
                language's own name to "O‘zbek…" is worse than not showing it.
                The name is still the button's accessible name, so a screen
                reader hears the language rather than two letters. */}
            <span aria-hidden="true">{entry.flag}</span>
            <span aria-hidden="true" className="uppercase">
              {entry.code}
            </span>
            <span className="sr-only">{entry.nativeName}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.a11y.selectLanguage')}
        className="press inline-flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-bold text-muted transition-colors hover:border-brand hover:text-content"
      >
        <Globe className="h-5 w-5" aria-hidden="true" />
        {!compact && <span className="uppercase">{language}</span>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-raised"
        >
          {LANGUAGE_LIST.map((entry) => (
            <button
              key={entry.code}
              type="button"
              role="menuitemradio"
              aria-checked={entry.code === language}
              onClick={() => choose(entry.code)}
              className={`press flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 px-3 text-left text-sm font-semibold transition-colors hover:bg-surface-2 ${
                entry.code === language ? 'text-brand-text' : 'text-content'
              }`}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{entry.flag}</span>
                {entry.nativeName}
              </span>
              {entry.code === language && (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Announce the change for assistive technology. */}
      <span className="sr-only" aria-live="polite">
        {active?.nativeName}
      </span>
    </div>
  );
};

export default LanguageSwitcher;
