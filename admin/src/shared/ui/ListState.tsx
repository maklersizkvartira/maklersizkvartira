'use client';

import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

/**
 * What a list page shows when it has no rows to show.
 *
 * Success-with-zero-rows and a failed request are not the same news, and until
 * this existed every queue rendered them identically: the same grey glyph, the
 * same "no data" title, and a muted sub-line that on a dead backend reads
 * "Failed to fetch" — a sentence indistinguishable from ordinary copy. A
 * moderator sees an empty queue, decides there is nothing to review, and closes
 * the tab. There was also no control anywhere on the page to try again.
 *
 * The shape follows the two places in this panel that already got it right —
 * `StaffScreen` and the dashboard's stats card — rather than inventing a third.
 */

interface ListStateProps {
  /** The queue's own glyph, shown when the list is genuinely empty. */
  icon: ReactNode;
  /** `common.noData`. */
  emptyTitle: string;
  /** `common.error`. */
  errorTitle: string;
  /** `common.retry`. */
  retryLabel: string;
  error: Error | null;
  onRetry: () => void;
}

export function ListState({
  icon,
  emptyTitle,
  errorTitle,
  retryLabel,
  error,
  onRetry,
}: ListStateProps) {
  if (!error) return <EmptyState icon={icon} title={emptyTitle} />;

  return (
    <EmptyState
      tone="danger"
      icon={<AlertTriangle size={26} />}
      title={errorTitle}
      description={error.message}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  );
}

/**
 * The same failure, when there are still rows on screen.
 *
 * `keepPreviousData` means a refetch that fails leaves the previous page
 * rendered and says nothing at all — stale rows presented as current. The
 * empty-state branch above never runs in that case, so the warning has to sit
 * above the table instead.
 */
export function ListErrorBanner({
  error,
  title,
  retryLabel,
  onRetry,
}: {
  error: Error | null;
  title: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-3 mb-3 rounded-[var(--radius-md)]"
      style={{
        background: 'var(--color-danger-bg)',
        border: '1px solid var(--color-danger-border)',
      }}
    >
      <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 2 }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}>
          {error.message}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
