'use client';

import { useState } from 'react';
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
 * The clamp is for the LABELS only. The arrows step from the page the admin
 * has ASKED for, so a request that landed past the end (the last row on page 2
 * was deleted) steps back to a page that exists instead of skipping one — and
 * the whole control stays mounted in that case, because "no controls at all"
 * is how a moderator gets stranded on an empty page.
 *
 * "Asked for", not `meta.page`: `keepPreviousData` holds `meta` at the
 * PREVIOUS page for the whole of a step, so stepping from it meant the label
 * still read "1 / 5" while page 2 was loading and a second, impatient tap on
 * Next recomputed 1 + 1 = 2 — the page already in flight. Nothing happened,
 * and the arrow read as broken. `hasNext` / `hasPrevious` are stale in exactly
 * the same way, so the arrows are gated on the page number instead; the
 * backend defines both as pure functions of it (`page * page_size < total`,
 * `page > 1`), so nothing is lost by deriving them.
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
  /** Where the server says the rows on screen came from. */
  const fetched = meta ? Math.max(1, meta.page) : 1;
  /** The step the admin asked for, tagged with the page it was asked FROM.
   *  Tagging is what retires it: once the answer lands, `fetched` no longer
   *  matches the tag and the real page takes over with no effect needed to
   *  clear it — which also covers the page a filter change resets to and the
   *  one `useAdminList` clamps back to off the end of a shrunken result. */
  const [requested, setRequested] = useState<{ page: number; from: number } | null>(null);

  if (!meta) return null;

  const totalPages = Math.max(1, meta.totalPages);
  const current = requested && requested.from === fetched ? requested.page : fetched;
  /** Labels and the highlighted button only, so a step past a shrinking result
   *  never renders as "3 / 1". The arrows keep the unclamped `current`. */
  const page = Math.min(current, totalPages);

  // A single page of results needs no controls at all — unless we are stranded
  // beyond it, where these controls are the only way back.
  if (totalPages <= 1 && current <= totalPages) return null;

  return (
    <nav className={`flex items-center justify-between gap-3 flex-wrap mt-4 ${className}`} aria-label={navLabel}>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {summary ? summary(page, totalPages) : `${page} / ${totalPages}`}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          className="page-btn"
          onClick={() => {
            setRequested({ page: current - 1, from: fetched });
            onPage(current - 1);
          }}
          disabled={current <= 1}
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
                onClick={() => {
                  setRequested({ page: entry, from: fetched });
                  onPage(entry);
                }}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </button>
            ),
          )}
        </div>

        <button
          className="page-btn"
          onClick={() => {
            setRequested({ page: current + 1, from: fetched });
            onPage(current + 1);
          }}
          disabled={current >= totalPages}
          aria-label={nextLabel}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
