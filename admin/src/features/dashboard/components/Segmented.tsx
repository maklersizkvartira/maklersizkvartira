'use client';

/**
 * A pill switcher. Used twice on the dashboard: to choose which time series
 * the trend card draws, and to choose which group of counters the reference
 * band shows on a phone.
 *
 * The container's display is passed in by the caller and never set in CSS —
 * on a phone it is `grid grid-cols-3 w-full`, so the pills are three equal
 * thumb targets with no horizontal scroll and no truncation; above `sm` it
 * becomes an inline row. `.seg` in globals.css deliberately paints only the
 * track, for the cascade-layer reason documented there.
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
