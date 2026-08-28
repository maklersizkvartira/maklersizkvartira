import type { AuditSeverity } from '@/shared/api/types';
import type { BadgeVariant } from '@/shared/ui/Badge';

/**
 * Severity is the audit feed's only at-a-glance signal, and `Badge`'s own
 * `statusVariant()` does not carry it: its map covers row *statuses*
 * (APPROVED, FAILED, …) and has no CRITICAL, so a critical row would come back
 * neutral grey — the one colour it must never be.
 *
 * So the feed maps severity itself. The two tables below are the same four
 * levels seen twice: once as a badge variant, once as the colour of the accent
 * bar down the left of a row.
 */

export const SEVERITY_VARIANT: Record<AuditSeverity, BadgeVariant> = {
  INFO: 'info',
  NOTICE: 'info',
  WARNING: 'warning',
  CRITICAL: 'danger',
};

export const SEVERITY_ACCENT: Record<AuditSeverity, string> = {
  INFO: 'var(--color-border-medium)',
  NOTICE: 'var(--accent)',
  WARNING: 'var(--color-warning)',
  CRITICAL: 'var(--color-danger)',
};

/** Anything the backend adds later ranks as INFO rather than crashing a cell. */
export function severityVariant(severity: string): BadgeVariant {
  return SEVERITY_VARIANT[severity as AuditSeverity] ?? 'neutral';
}

export function severityAccent(severity: string): string {
  return SEVERITY_ACCENT[severity as AuditSeverity] ?? 'var(--color-border-medium)';
}
