'use client';

import { Badge, statusVariant, type BadgeVariant } from './Badge';

/**
 * A status badge with a leading dot.
 *
 * Badge alone is a coloured chip; in a dense table the dot is what lets a
 * moderator scan a column of thirty rows without reading any of the words.
 * Colour is never the only signal — the label still carries the meaning for
 * anyone who cannot separate the hues.
 */

const dotColor: Record<BadgeVariant, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--accent)',
  neutral: 'var(--color-text-muted)',
};

interface StatusPillProps {
  /** Backend enum, e.g. PENDING_VERIFICATION. Case-insensitive. */
  status: string;
  /** Translated text; falls back to the prettified enum. */
  label?: string;
  /** Pulse the dot — for states that are actively being worked. */
  pulse?: boolean;
  className?: string;
}

export function StatusPill({ status, label, pulse = false, className = '' }: StatusPillProps) {
  const variant = statusVariant(status);

  return (
    <Badge
      variant={variant}
      className={`gap-1.5 ${className}`}
      label={
        <>
          <span
            className={`status-dot ${pulse ? 'animate-pulse-status' : ''}`}
            style={{ width: 6, height: 6, background: dotColor[variant] }}
          />
          {label ?? status.replace(/_/g, ' ')}
        </>
      }
    />
  );
}
