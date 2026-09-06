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

/**
 * The four levels this build ships, in ascending order.
 *
 * It lives here rather than beside the feed's filter dropdown because two other
 * screens now label a severity — the user detail page's activity list and the
 * dashboard's activity chart — and each of them had to know the closed list to
 * hand it to `enumLabeller`. One array means a fifth backend level is added in
 * one file instead of three.
 */
export const AUDIT_SEVERITIES: AuditSeverity[] = ['INFO', 'NOTICE', 'WARNING', 'CRITICAL'];

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
