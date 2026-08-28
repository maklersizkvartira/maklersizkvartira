'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@/shared/api/types';

/**
 * Page navigation for every list in the panel.
 *
 * The backend reports totalPages: 0 when a filter matches nothing, so the naive
 * render is "Page 1 of 0". That clamp lives here, once, rather than in each of
 * the twelve list pages — anyone reading `meta.totalPages` elsewhere should
 * expect the raw value.
 *
 * The clamp is for the LABELS only. The arrows step from `meta.page`, the page
 * actually fetched, so a request that landed past the end (the last row on
 * page 2 was deleted) steps back to a page that exists instead of skipping one
 * — and the whole control stays mounted in that case, because "no controls at
 * all" is how a moderator gets stranded on an empty page.
 *
 * Every visible string is injected, as everywhere else in this kit: the
 * components take labels, the pages hold the translator.
 */

interface PaginationProps {
  meta: PageMeta | undefined;
  onPage: (page: number) => void;
  /** Translated "Page {page} of {total}". Falls back to "1 / 3" when absent. */
  summary?: (page: number, totalPages: number) => string;
  /** Accessible names. English is the fallback, not the intent. */
  navLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}

/** Window of page buttons around the current page, with 1 and last always
 *  present and gaps collapsed to an ellipsis. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | 'gap')[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);

  if (from > 2) out.push('gap');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push('gap');

  out.push(total);
  return out;
}

export function Pagination({
  meta,
  onPage,
  summary,
  navLabel = 'Pagination',
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  className = '',
}: PaginationProps) {
  if (!meta) return null;

  const totalPages = Math.max(1, meta.totalPages);
  /** Where the server thinks we are — which can be past the last page. */
  const fetched = Math.max(1, meta.page);
  const page = Math.min(fetched, totalPages);

  // A single page of results needs no controls at all — unless we are stranded
  // beyond it, where these controls are the only way back.
  if (totalPages <= 1 && fetched <= totalPages) return null;

  return (
    <nav className={`flex items-center justify-between gap-3 flex-wrap mt-4 ${className}`} aria-label={navLabel}>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {summary ? summary(page, totalPages) : `${page} / ${totalPages}`}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          className="page-btn"
          onClick={() => onPage(fetched - 1)}
          disabled={!meta.hasPrevious || fetched <= 1}
          aria-label={previousLabel}
        >
          <ChevronLeft size={15} />
        </button>

        {/* Numbers are desktop-only: on a phone the prev/next pair plus the
            "3 / 12" summary is the whole affordance anyone needs. */}
        <div className="hidden sm:flex items-center gap-1.5">
          {pageWindow(page, totalPages).map((entry, i) =>
            entry === 'gap' ? (
              <span key={`gap-${i}`} className="page-ellipsis">…</span>
            ) : (
              <button
                key={entry}
                className={`page-btn ${entry === page ? 'page-btn-active' : ''}`}
                onClick={() => onPage(entry)}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </button>
            ),
          )}
        </div>

        <button
          className="page-btn"
          onClick={() => onPage(fetched + 1)}
          disabled={!meta.hasNext || fetched >= totalPages}
          aria-label={nextLabel}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
