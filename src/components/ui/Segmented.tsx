/**
 * The segmented control.
 *
 * The canonical version is the rent-type switch on ListingsPage — a
 * `rounded-2xl bg-surface-2 p-1` track holding equal-width `rounded-xl`
 * buttons, with the active one filled in brand — and the same shape is
 * re-typed for the rental-type picker in the create wizard and the media tabs
 * on the listing detail page.
 *
 * Three things are decided here that the copies each decided differently.
 *
 * Every segment is `min-h-11`. The copies used `py-2.5` on 13px text, which
 * is 38px: below the 44px target, on a control whose whole point is that it
 * is tapped rather than opened.
 *
 * It is a real radio group. The copies were rows of plain buttons, so the
 * active segment was announced as "button" with nothing to say it was the
 * chosen one, and arrow keys did nothing. `role="radiogroup"` plus arrow-key
 * navigation is what a native segmented control gives, and it costs a dozen
 * lines to give back.
 *
 * And the value is generic. Callers pass their own union — 'ALL' | 'FULL' |
 * 'ROOMMATE' — and get it back in `onChange` without a cast.
 */

import React, { useCallback, useRef } from 'react';

import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Names the group for assistive technology. */
  label?: string;
  /** Segments share the width equally. Off, they size to their content. */
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  fullWidth = true,
  size = 'md',
  className,
}: SegmentedProps<T>): React.ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);

  /**
   * The one segment that carries the tab stop.
   *
   * Normally that is the selected one, which is the roving-tabindex pattern a
   * radio group is expected to follow. It cannot be when the selected segment
   * is also disabled: a disabled button is not focusable, so the group's only
   * tab stop was on something Tab skips while every other segment sat at
   * `-1` — the whole control became unreachable by keyboard, with no way to
   * move the selection off the option that had been taken away. The first
   * enabled segment takes the stop instead.
   */
  const tabStop =
    options.find((option) => option.value === value && !option.disabled)?.value ??
    options.find((option) => !option.disabled)?.value;

  /** Arrow keys move between segments and select as they go, as a native
   *  radio group does — the selection IS the focus in this control. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (!step) return;
      event.preventDefault();

      const enabled = options.filter((option) => !option.disabled);
      if (!enabled.length) return;
      const current = enabled.findIndex((option) => option.value === value);
      const next = enabled[(current + step + enabled.length) % enabled.length];
      onChange(next.value);

      // Move focus with the selection, otherwise the next arrow press starts
      // over from whichever segment the pointer last happened to focus.
      const target = trackRef.current?.querySelector<HTMLElement>(
        `[data-segment="${next.value}"]`,
      );
      target?.focus();
    },
    [options, value, onChange],
  );

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex rounded-2xl bg-surface-2 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-segment={option.value}
            aria-checked={active}
            // Only one segment is in the tab order; the arrow keys reach the
            // others. See `tabStop` for why that is not always the selected
            // one.
            tabIndex={option.value === tabStop ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl font-bold transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              size === 'sm' ? 'px-3 text-xs' : 'px-4 text-[13px]',
              fullWidth ? 'flex-1' : '',
              active ? 'bg-brand text-on-brand shadow-sm' : 'text-muted hover:text-content',
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
