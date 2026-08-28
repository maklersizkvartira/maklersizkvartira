/**
 * The pill-shaped filter chip.
 *
 * The canonical version is the quick-filter row on ListingsPage:
 *
 *     inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2
 *     text-xs font-bold transition-all
 *       selected → border-brand bg-brand-soft text-brand-text
 *       else     → border-transparent bg-surface-2 text-muted
 *
 * Two things are fixed here rather than copied.
 *
 * `py-2` on a `text-xs` line gives a 32px tall target. That is a comfortable
 * click and a genuinely hard tap: the WCAG target size is 44px, which is
 * roughly the pad of an adult thumb, and this row of chips is the very first
 * thing a phone user touches on the listings page. `min-h-11` is 44px, and
 * the padding stays where it was so the chip does not visually inflate — it
 * grows into the space it should already have occupied.
 *
 * And `aria-pressed`. A chip is a toggle, and every hand-rolled one that
 * lacked the attribute announced itself as an ordinary button, so a screen
 * reader user could not tell which filters were already on.
 */

import React from 'react';

import { cn } from '../../lib/cn';

type ChipTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';
type ChipSize = 'sm' | 'md';

const selectedTones: Record<ChipTone, string> = {
  brand: 'border-brand bg-brand-soft text-brand-text',
  neutral: 'border-line-2 bg-surface-3 text-content',
  success: 'border-success/40 bg-success-soft text-success',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  danger: 'border-danger/40 bg-danger-soft text-danger',
};

const countTones: Record<ChipTone, string> = {
  brand: 'bg-brand text-on-brand',
  neutral: 'bg-content text-canvas',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
};

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  label: string;
  selected?: boolean;
  /** A badge on the trailing edge — how many listings match, usually. */
  count?: number;
  /** Leading glyph. Takes a component, matching the lucide-react call style. */
  icon?: React.ComponentType<{ className?: string }>;
  tone?: ChipTone;
  size?: ChipSize;
  /** Trailing ✕ for a chip that represents an applied filter. */
  onRemove?: () => void;
  removeLabel?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  count,
  icon: Icon,
  tone = 'brand',
  size = 'md',
  onRemove,
  removeLabel,
  className,
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    type="button"
    disabled={disabled}
    aria-pressed={selected}
    className={cn(
      // `min-h-11` (44px) is the tap target; the horizontal padding is the
      // original, so the chip keeps the width it always had.
      'press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border',
      'font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'px-3 text-[11px]' : 'px-4 text-xs',
      selected
        ? selectedTones[tone]
        : 'border-transparent bg-surface-2 text-muted hover:text-content',
      className,
    )}
  >
    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    <span className="truncate">{label}</span>

    {count !== undefined && (
      <span
        className={cn(
          'ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums',
          selected ? countTones[tone] : 'bg-surface-3 text-muted',
        )}
      >
        {count}
      </span>
    )}

    {onRemove && (
      // A <span> and not a nested <button>: a button inside a button is
      // invalid HTML and browsers resolve it by dropping one of them, which
      // is how a remove control ends up unclickable.
      <span
        role="button"
        tabIndex={0}
        aria-label={removeLabel ?? label}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
        className="-mr-1.5 ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:opacity-100"
      >
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" aria-hidden="true">
          <path
            d="M5 5l10 10M15 5L5 15"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    )}
  </button>
);

// ---------------------------------------------------------------------------
/**
 * The horizontally scrolling row chips live in.
 *
 * The negative margin plus matching padding is what lets the row bleed to the
 * screen edges on a phone while the first and last chip still clear them —
 * copied from ListingsPage, where it was already right.
 */
export const ChipRow: React.FC<{
  children: React.ReactNode;
  label?: string;
  className?: string;
}> = ({ children, label, className }) => (
  <div
    role="group"
    aria-label={label}
    className={cn(
      'hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0',
      className,
    )}
  >
    {children}
  </div>
);

export default Chip;
