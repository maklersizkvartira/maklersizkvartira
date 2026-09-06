'use client';

/**
 * A pill switcher, used wherever a screen has three or four exclusive views
 * of the same thing. It still lives under `features/dashboard` because that
 * is where it was written; four screens read it now:
 *
 *   /ai        — the tab switcher between usage, settings and conversations
 *   /analytics — the date range, and which series the chart draws
 *   StatBand   — which group of counters the reference band shows on a phone
 *   TrendCard  — which time series it draws
 *
 * The container's display is passed in by the caller and never set in CSS,
 * and that is the whole point: on a phone every one of those call sites wants
 * `grid grid-cols-3 w-full`, so the pills become equal thumb targets with no
 * horizontal scroll and no truncation, while from `sm` up they read better as
 * an inline row. A component that decided this for itself would be wrong on
 * one of the four. `.seg` in globals.css deliberately paints only the track,
 * for the cascade-layer reason documented there.
 */

export interface SegmentedItem<T extends string> {
  key: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  items: readonly SegmentedItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Names the control for a screen reader; there is no visible legend. */
  ariaLabel: string;
  className?: string;
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`seg ${className}`}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          data-active={item.key === value}
          className="seg-item truncate"
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
