/**
 * Language switcher.
 *
 * A menu rather than a cycling button: with three languages, a cycle makes a
 * user press twice to go back one, and never shows what the options are.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';

import { LANGUAGE_LIST, useTranslation, type Language } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.a11y.selectLanguage')}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-xs font-bold text-muted transition-colors hover:border-brand hover:text-content"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
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
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-surface-2 ${
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
