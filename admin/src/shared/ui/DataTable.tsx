'use client';

import { type ReactNode, useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from './Skeleton';

/**
 * One dataset, two renderings.
 *
 * From lg up it is a real <table> inside the shared .table-scroll treatment.
 * Below lg it becomes a stacked label/value card list, because an admin panel
 * that needs sideways scrolling on a phone is an admin panel nobody moderates
 * from — and this project is phone-first.
 *
 * The column definitions drive both renderings, so a column added for the
 * table shows up in the cards for free.
 */

export interface Column<Row> {
  /** Stable id; also the fallback header text and the card row label. */
  key: string;
  header: string;
  /** Any CSS width, applied to the <col>. Ignored in card mode. */
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** Omit to render `String(row[key])`. */
  render?: (row: Row) => ReactNode;
  /** Hide this column from the mobile cards — for actions or decoration
   *  that only makes sense beside a table row. */
  hideOnCard?: boolean;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[] | undefined;
  /** Stable React key per row — never the array index, or a re-sort will
   *  reuse the wrong DOM node and carry stale focus with it. */
  keyOf: (row: Row) => string | number;
  loading?: boolean;
  /**
   * Rendered when there is nothing to show and nothing is loading — normally
   * an <EmptyState>. Required on purpose: every empty list needs copy in the
   * viewer's language, and a default here could only ever be English.
   */
  empty: ReactNode;
  onRowClick?: (row: Row) => void;
  /** Skeleton rows drawn while loading. Match the page size you request. */
  loadingRows?: number;
  className?: string;
  minWidth?: string;
}

function cellValue<Row>(column: Column<Row>, row: Row): ReactNode {
  if (column.render) return column.render(row);
  const raw = (row as Record<string, unknown>)[column.key];
  return raw === null || raw === undefined || raw === '' ? '—' : String(raw);
}

export function DataTable<Row>({
  columns,
  rows,
  keyOf,
  loading = false,
  empty,
  onRowClick,
  loadingRows = 8,
  className = '',
  minWidth = '980px',
}: DataTableProps<Row>) {
  const c = useTranslations('common');
  const clickable = Boolean(onRowClick);
  const cardColumns = columns.filter((c) => !c.hideOnCard);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => checkScroll());
      observer.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      if (observer) observer.disconnect();
    };
  }, [checkScroll, rows, loading]);

  const scrollByDirection = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const delta = direction === 'left' ? -320 : 320;
    scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className={className}>
        {/* Desktop: skeletons inside the real table so the column widths the
            data will land in are already settled when it arrives. */}
        <div className="hidden lg:block data-table-wrap data-table-scroll">
          <table className="data-table" style={{ minWidth }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} style={{ width: column.width, textAlign: column.align ?? 'left' }}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }, (_, i) => (
                <tr key={i}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      <Skeleton height={12} radius="var(--radius-xs)" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden data-cards">
          {Array.from({ length: Math.min(loadingRows, 5) }, (_, i) => (
            <div key={i} className="data-card">
              {cardColumns.slice(0, 4).map((column) => (
                <div key={column.key} className="data-card-row">
                  <Skeleton width={70} height={9} radius="var(--radius-xs)" />
                  <Skeleton width={110} height={11} radius="var(--radius-xs)" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <div className={`card ${className}`}>{empty}</div>;
  }

  return (
    <div className={className}>
      {/* ── Table (lg and up) ── */}
      <div className="hidden lg:block relative data-table-wrap">
        {/* Horizontal scroll hint & navigation bar when table overflows */}
        {(canScrollLeft || canScrollRight) && (
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-[var(--color-surface-2)]/90 backdrop-blur border-b border-[var(--color-border)] text-xs select-none">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
              <ArrowLeftRight size={13} className="shrink-0" style={{ color: 'var(--accent)' }} />
              <span>{c('tableWide')}</span>
              <span className="text-[var(--color-text-muted)] font-normal">
                {c('tableWideHint')}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollByDirection('left')}
                disabled={!canScrollLeft}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-semibold bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:pointer-events-none transition-all border border-[var(--color-border-medium)] text-[var(--color-text-primary)] active:scale-95"
                title={c('scrollLeft')}
              >
                <ChevronLeft size={13} />
                <span>{c('scrollLeft')}</span>
              </button>
              <button
                type="button"
                onClick={() => scrollByDirection('right')}
                disabled={!canScrollRight}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-semibold bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:pointer-events-none transition-all border border-[var(--color-border-medium)] text-[var(--color-text-primary)] active:scale-95"
                title={c('scrollRight')}
              >
                <span>{c('scrollRight')}</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Left and Right Fade Indicators */}
        {canScrollLeft && (
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 transition-opacity"
            style={{
              background: 'linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent)',
            }}
          />
        )}
        {canScrollRight && (
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 transition-opacity"
            style={{
              background: 'linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent)',
            }}
          />
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="data-table-scroll"
        >
          <table className="data-table" style={{ minWidth }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} style={{ width: column.width, textAlign: column.align ?? 'left' }}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={keyOf(row)}
                  data-clickable={clickable}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick?.(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                      {cellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stacked cards (below lg) ── */}
      <div className="lg:hidden data-cards">
        {rows.map((row) => {
          const body = cardColumns.map((column) => (
            <div key={column.key} className="data-card-row">
              <span className="data-card-label">{column.header}</span>
              <span className="data-card-value">{cellValue(column, row)}</span>
            </div>
          ));

          // A div with a role, not a <button>: a cell may render its own
          // button (the balance "+" on the users table did), and a button
          // inside a button is invalid HTML that React refuses to hydrate.
          return clickable ? (
            <div
              key={keyOf(row)}
              role="button"
              tabIndex={0}
              className="data-card"
              data-clickable="true"
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick?.(row);
                }
              }}
            >
              {body}
            </div>
          ) : (
            <div key={keyOf(row)} className="data-card">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
