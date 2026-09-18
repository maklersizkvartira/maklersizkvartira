'use client';

import { statusVariant, type BadgeVariant } from './Badge';

/**
 * The status chip SotuvchiAi draws in every table column: a rounded-full
 * pill, 10px bold uppercase, tinted with the status colour at ~12% and the
 * text in the full colour. No border, no dot — the same recipe as its
 * orders / leads / payments tables so the two panels read identically.
 */

const tone: Record<BadgeVariant, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--accent)',
  neutral: 'var(--color-text-secondary)',
  purple: '#9333ea',
};

interface StatusPillProps {
  /** Backend enum, e.g. PENDING_VERIFICATION. Case-insensitive. */
  status: string;
  /** Translated text; falls back to the prettified enum. */
  label?: string;
  /** Kept for callers; the pill itself no longer animates. */
  pulse?: boolean;
  className?: string;
}

export function StatusPill({ status, label, className = '' }: StatusPillProps) {
  const variant = statusVariant(status);
  const color = tone[variant];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
      }}
    >
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}
