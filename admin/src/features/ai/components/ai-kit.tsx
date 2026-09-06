'use client';

import { type ReactNode } from 'react';

import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * The two pieces every block on /ai is assembled from.
 *
 * The page is four sections that have to read as one screen — spend, usage,
 * settings, and the conversation log — so the heading row and the numeral are
 * defined once here instead of four times inline. Neither carries a colour of
 * its own: the tone arrives through the `--tone-*` custom properties the
 * card's `.tone-*` class sets, which is how the dashboard's cards work and the
 * reason a block changes meaning by swapping one class name.
 */

interface SectionHeadProps {
  /** A lucide glyph at 17px; the tinted tile around it comes from `.icon-tile`. */
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Trailing chrome — a status pill, a refresh button. Never wraps under. */
  aside?: ReactNode;
}

export function SectionHead({ icon, title, subtitle, aside }: SectionHeadProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="icon-tile flex-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {aside && <div className="flex items-center gap-2 shrink-0">{aside}</div>}
    </div>
  );
}

interface FigureProps {
  label: string;
  /**
   * Already formatted, and already decided. A caller with nothing to show
   * passes an em dash — this component will not turn a missing value into a
   * zero, which on the spend card would be a money figure nobody measured.
   */
  value: string;
  hint?: string;
  loading?: boolean;
  /** px. The default suits a counter; the spend figures ask for more. */
  size?: number;
}

export function Figure({ label, value, hint, loading = false, size = 22 }: FigureProps) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium mb-1.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      {loading ? (
        <Skeleton width="70%" height={size} radius="var(--radius-xs)" />
      ) : (
        // `.stat-num` for the tabular figures: the spend numbers refresh in
        // place every five minutes and the row must not twitch when a digit
        // changes width.
        <p className="stat-num truncate" style={{ fontSize: size }}>
          {value}
        </p>
      )}
      {hint && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
