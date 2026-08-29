'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/Button';

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

/* ─── Plot height ──────────────────────────────────────────────────────────
   One class, applied identically by the chart, by its loading skeleton and by
   its empty state, so a card cannot change height as the data arrives. It is
   shorter on a phone because 240px of plot plus a header plus a legend is
   most of a small viewport spent on one card. */
export const CHART_BODY_CLASS = 'h-[200px] sm:h-[240px]';

/* ─── The two non-chart states ─────────────────────────────────────────────
   Empty and error are DIFFERENT ANSWERS and must not look alike. Every chart
   on this page used to render `query.data ?? []`, so a 500 arrived at the card
   as an empty array and drew "Nothing to chart yet" — a sentence that says the
   platform is quiet when in fact the panel has no idea. The districts endpoint
   makes that unforgivable rather than merely sloppy: `[]` is a legitimate
   answer there (a fresh deployment has no listings), so the empty state is the
   one state a reader has been trained to believe.

   So: empty is muted grey text and nothing else, error is a danger-toned line
   with a warning glyph and the retry that empty deliberately does not offer.
   Both occupy CHART_BODY_CLASS, so neither changes the card's height. */

export function ChartEmpty({ text, className = CHART_BODY_CLASS }: { text: string; className?: string }) {
  return (
    <p
      className={`flex items-center justify-center text-sm ${className}`}
      style={{ color: 'var(--color-text-muted)' }}
    >
      {text}
    </p>
  );
}

export function ChartError({
  text,
  retryLabel,
  onRetry,
  className = CHART_BODY_CLASS,
}: {
  text: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 px-4 text-center ${className}`}
    >
      <p
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--color-danger)' }}
      >
        <AlertTriangle size={15} aria-hidden="true" />
        {text}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
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

  /**
   * Clamped at both ends, not only the right. `.card` sets `overflow: hidden`
   * and this is an absolutely positioned HTML layer inside it, so a tooltip
   * anchored to the first or last point gets sliced off at the card edge —
   * and the trend card's narrower phone plot pushes the first point further
   * left than the old right-only flip ever accounted for.
   */
  const shift = tooltip.x > 60 ? '-105%' : tooltip.x < 12 ? '0%' : '5%';

  return (
    <div
      className="chart-tooltip absolute z-10 whitespace-nowrap"
      style={{
        left: `${tooltip.x}%`,
        top: `${tooltip.y}%`,
        transform: `translate(${shift}, -50%)`,
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
