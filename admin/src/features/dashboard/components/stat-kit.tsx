'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useLocale } from 'next-intl';

import { useCountUp } from '@/features/dashboard/hooks/use-count-up';
import type { ToneName } from '@/features/dashboard/dashboard-groups';

/**
 * The small pieces every dashboard card is assembled from.
 *
 * Each one is a thin wrapper over a class in globals.css, and none of them
 * carries a colour of its own: colour arrives through the `.tone-*` custom
 * properties set by an ancestor, so a card changes meaning by swapping one
 * class name on its outermost element.
 */

/** Maps a tone name to the class that defines --tone, --tone-bg and friends. */
export const TONE_CLASS: Record<ToneName, string> = {
  accent: 'tone-accent',
  success: 'tone-success',
  warning: 'tone-warning',
  danger: 'tone-danger',
  neutral: 'tone-neutral',
};

/* ─── Numbers ─────────────────────────────────────────────────────────────── */

interface StatNumProps {
  children: ReactNode;
  /**
   * px. The whole hierarchy of the page is carried by this one value.
   * Omit it and set the size with a Tailwind class instead when the numeral
   * has to change size at a breakpoint — an inline `fontSize` would beat the
   * `sm:` utility, silently, and the hero would stay at its phone size.
   */
  size?: number;
  /** Paint the numeral with the ambient tone instead of primary ink. */
  toned?: boolean;
  /** Deliberately muted — used for a zero that should not shout. */
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function StatNum({ children, size, toned, muted, className = '', style }: StatNumProps) {
  return (
    <span
      className={`stat-num ${className}`}
      style={{
        ...(size !== undefined ? { fontSize: size } : {}),
        ...(toned ? { color: 'var(--tone)' } : {}),
        ...(muted ? { color: 'var(--color-text-muted)' } : {}),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/**
 * A counter that eases to its value in the reader's own number format.
 *
 * `.stat-num` sets tabular figures, which is what stops the surrounding layout
 * from twitching while the digits change width.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 700,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const locale = useLocale();
  const shown = useCountUp(value, duration);

  const format = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [locale, decimals],
  );

  return <>{format.format(decimals > 0 ? shown : Math.round(shown))}</>;
}

/* ─── Labels ──────────────────────────────────────────────────────────────── */

export function StatLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`stat-label ${className}`}>{children}</span>;
}

/* ─── Icon tile ───────────────────────────────────────────────────────────── */

/**
 * The tinted square that opens a card. `.flex-center` supplies the display —
 * `.icon-tile` is not allowed to, for the cascade-layer reason documented
 * above the dashboard block in globals.css.
 *
 * Its cut corner echoes the card signature one scale down.
 */
export function IconTile({
  children,
  size = 36,
  className = '',
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`icon-tile flex-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/* ─── Live pill ───────────────────────────────────────────────────────────── */

/** Shown only while there is genuinely something waiting — see TriageCard. */
export function LivePill({ label }: { label: string }) {
  return (
    <span
      className="badge inline-flex shrink-0 items-center gap-1.5"
      style={{
        background: 'var(--tone-bg)',
        color: 'var(--tone)',
        border: '1px solid var(--tone-border)',
      }}
    >
      <span
        className="status-dot animate-pulse-status"
        style={{ width: 6, height: 6, background: 'var(--tone)' }}
      />
      {label}
    </span>
  );
}

/* ─── Meter ───────────────────────────────────────────────────────────────── */

/**
 * A relative-magnitude bar. `value` is measured against the largest value in
 * its own group, so the bar answers "which of these is worst" — a different
 * question from the numeral beside it, which answers "how many".
 */
export function Meter({
  value,
  max,
  height = 3,
  delayMs = 0,
  className = '',
}: {
  value: number;
  max: number;
  height?: number;
  /** Cascades a row of bars so a group fills top-down instead of all at once. */
  delayMs?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <span aria-hidden="true" className={`meter block ${className}`} style={{ height }}>
      <span
        className="meter-fill block"
        style={{ width: `${pct}%`, transitionDelay: `${delayMs}ms` }}
      />
    </span>
  );
}
