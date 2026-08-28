'use client';

import { useState, type ReactNode } from 'react';

/**
 * Pieces every chart in the panel shares. Kept in one file so the series
 * colours, the tooltip chrome and the number formatting cannot drift apart
 * between the four chart types on the dashboard.
 *
 * No charting library on purpose: these are four fixed shapes over small
 * arrays, and a 60kB dependency to draw them would cost more than it saves.
 */

/* ─── Series colours ────────────────────────────────────────────────────────
   Slots are assigned by entity in a fixed order and never cycled — the fifth
   series is the last one that gets its own hue; a sixth belongs in "Other".
   The values live in globals.css so both themes get chosen steps rather than
   an automatic flip, and so slot 1 tracks whatever accent the user picked. */
export const SERIES_VARS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export function seriesColor(index: number): string {
  return SERIES_VARS[index] ?? 'var(--color-text-muted)';
}

/** Severity is a state, not an identity, so it draws from the status tokens.
 *  Every consumer pairs these with a written label — colour alone never
 *  carries the meaning. */
export const SEVERITY_VARS: Record<string, string> = {
  INFO: 'var(--accent)',
  NOTICE: 'var(--accent)',
  WARNING: 'var(--color-warning)',
  SERIOUS: 'var(--color-warning)',
  CRITICAL: 'var(--color-danger)',
  DANGER: 'var(--color-danger)',
  OK: 'var(--color-success)',
  SUCCESS: 'var(--color-success)',
};

export function severityColor(key: string, fallbackIndex = 0): string {
  return SEVERITY_VARS[key.toUpperCase()] ?? seriesColor(fallbackIndex);
}

/* ─── Shapes ─────────────────────────────────────────────────────────────── */

export interface Series {
  /** Stable id — the colour follows this, not the array position after a
   *  filter, so hiding one series never repaints the survivors. */
  key: string;
  /** Translated name shown in the legend and the tooltip. */
  label: string;
  values: number[];
  /** Override the slot colour — pass a status var for severity charts. */
  color?: string;
}

/* ─── Formatting ─────────────────────────────────────────────────────────── */

/** Axis-scale abbreviation. Locale-aware for the digits, unit-agnostic. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

/** "Nice" axis ceiling so gridlines land on round numbers. */
export function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/* ─── Legend ──────────────────────────────────────────────────────────────
   Present whenever there are two or more series; a single-series chart is
   named by its card title instead of carrying a one-row legend box. */
export function ChartLegend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span
            aria-hidden="true"
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: s.color ?? seriesColor(i) }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ─── Tooltip ─────────────────────────────────────────────────────────────
   An HTML layer over the SVG rather than an SVG <title>: native tooltips
   arrive half a second late and cannot show a colour swatch per series. */

export interface TooltipState {
  /** Position in percent of the container box, so it survives the responsive
   *  viewBox scaling without a resize observer. */
  x: number;
  y: number;
  content: ReactNode;
}

export function useChartTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  return { tooltip, setTooltip, hide: () => setTooltip(null) };
}

export function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;

  return (
    <div
      className="chart-tooltip absolute z-10 whitespace-nowrap"
      style={{
        left: `${tooltip.x}%`,
        top: `${tooltip.y}%`,
        // Flip to the left of the cursor past the midpoint so the tooltip
        // never runs off the card edge.
        transform: `translate(${tooltip.x > 60 ? '-105%' : '5%'}, -50%)`,
      }}
      role="tooltip"
    >
      {tooltip.content}
    </div>
  );
}

/** Tooltip body: a bold heading and one swatch-prefixed row per series. */
export function TooltipRows({
  heading,
  rows,
}: {
  heading: string;
  rows: { key: string; label: string; value: string; color: string }[];
}) {
  return (
    <>
      <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        {heading}
      </p>
      {rows.map((row) => (
        <p key={row.key} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
          {row.label}
          <span className="font-semibold ml-auto pl-3" style={{ color: 'var(--color-text-primary)' }}>
            {row.value}
          </span>
        </p>
      ))}
    </>
  );
}
