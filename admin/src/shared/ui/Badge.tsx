'use client';

import { type ReactNode } from 'react';

/**
 * Maps maklersiz status enums to the .badge-* palette in globals.css.
 *
 * The backend sends these SCREAMING_CASE; keys are matched case-insensitively
 * so a lowercased value from a filter dropdown lands on the same colour as the
 * value that came off the wire.
 */

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantMap: Record<string, BadgeVariant> = {
  // Settled, good outcomes
  ACTIVE: 'success',
  APPROVED: 'success',
  SENT: 'success',
  RESOLVED: 'success',
  // Waiting on a human or on the queue
  PENDING: 'warning',
  PENDING_VERIFICATION: 'warning',
  WARNING: 'warning',
  UNDER_REVIEW: 'warning',
  QUEUED: 'warning',
  // Settled, bad outcomes — plus OPEN, which for a report means unactioned
  REJECTED: 'danger',
  BANNED: 'danger',
  SUSPENDED: 'danger',
  FAILED: 'danger',
  OPEN: 'danger',
  // Out of play
  ARCHIVED: 'neutral',
  DRAFT: 'neutral',
  SKIPPED: 'neutral',
  // Purely informational
  INFO: 'info',
  NOTICE: 'info',
};

const variantStyles: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

/** Exported so StatusPill and any page that colours a chart series or an icon
 *  box by status resolves it the same way this component does. */
export function statusVariant(status?: string): BadgeVariant {
  if (!status) return 'neutral';
  return variantMap[status.toUpperCase()] ?? 'neutral';
}

interface BadgeProps {
  status?: string;
  variant?: BadgeVariant;
  /** Pass the translated text; without it the raw enum is prettified.
   *  ReactNode rather than string so StatusPill can prepend its dot. */
  label?: ReactNode;
  className?: string;
}

export function Badge({ status, variant, label, className = '' }: BadgeProps) {
  const resolvedVariant = variant ?? statusVariant(status);
  const displayLabel = label ?? (status ? status.replace(/_/g, ' ') : '');

  return (
    <span
      className={`
        inline-flex items-center px-3 py-1
        text-[10px] font-bold rounded-md
        whitespace-nowrap tracking-wide
        ${variantStyles[resolvedVariant]}
        ${className}
      `}
    >
      {displayLabel}
    </span>
  );
}
