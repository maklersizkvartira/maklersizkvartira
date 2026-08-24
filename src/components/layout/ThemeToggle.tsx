/**
 * Theme control.
 *
 * `compact` renders a single button that flips light/dark — the common case
 * in the header. The full control offers all three options including
 * "follow the system", which the previous build had no way to express.
 */

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useTheme, type ThemePreference } from '../../theme/ThemeProvider';

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = true }) => {
  const { t } = useTranslation();
  const { preference, isDark, setPreference, toggle } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? t('common.theme.switchToLight') : t('common.theme.switchToDark')}
        title={isDark ? t('common.theme.switchToLight') : t('common.theme.switchToDark')}
        className="rounded-xl border border-line bg-surface p-2 text-muted transition-colors hover:border-brand hover:text-content"
      >
        {isDark ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    );
  }

  const options: Array<{
    value: ThemePreference;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }> = [
    { value: 'light', icon: Sun, label: t('common.theme.light') },
    { value: 'dark', icon: Moon, label: t('common.theme.dark') },
    { value: 'system', icon: Monitor, label: t('common.theme.system') },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t('common.theme.label')}
      className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          onClick={() => setPreference(option.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors ${
            preference === option.value
              ? 'bg-surface text-content shadow-card'
              : 'text-muted hover:text-content'
          }`}
        >
          <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
