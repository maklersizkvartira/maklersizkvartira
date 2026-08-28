'use client';

import { type ReactNode } from 'react';
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
}: DataTableProps<Row>) {
  const clickable = Boolean(onRowClick);
  const cardColumns = columns.filter((c) => !c.hideOnCard);

  if (loading) {
    return (
      <div className={className}>
        {/* Desktop: skeletons inside the real table so the column widths the
            data will land in are already settled when it arrives. */}
        <div className="hidden lg:block card table-scroll">
          <table className="data-table">
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
      <div className="hidden lg:block card table-scroll">
        <table className="data-table">
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
                onClick={clickable ? () => onRowClick?.(row) : undefined}
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

      {/* ── Stacked cards (below lg) ── */}
      <div className="lg:hidden data-cards">
        {rows.map((row) => {
          const body = cardColumns.map((column) => (
            <div key={column.key} className="data-card-row">
              <span className="data-card-label">{column.header}</span>
              <span className="data-card-value">{cellValue(column, row)}</span>
            </div>
          ));

          // A real <button> when the row is actionable, so it is reachable by
          // keyboard and announced as activatable; a plain div otherwise.
          return clickable ? (
            <button
              key={keyOf(row)}
              type="button"
              className="data-card"
              data-clickable="true"
              onClick={() => onRowClick?.(row)}
            >
              {body}
            </button>
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
