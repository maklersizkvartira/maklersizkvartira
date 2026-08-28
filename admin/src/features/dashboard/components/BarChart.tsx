'use client';

import { useMemo, useState } from 'react';
import {
  ChartLegend,
  ChartTooltip,
  TooltipRows,
  compact,
  niceMax,
  seriesColor,
  useChartTooltip,
  type Series,
} from './chart-shared';

/**
 * Bars, in the two arrangements the dashboard needs:
 *
 *  · horizontal, one series — ranked categories (top districts). Horizontal
 *    because district names are words, and words rotated 45° under a vertical
 *    axis are words nobody reads.
 *  · vertical, stacked — a composition per time bucket (activity by severity).
 *
 * Both anchor to a zero baseline. A bar chart that starts its axis at 40 is
 * lying about the ratios it draws, so `max` always includes zero.
 */

interface BarChartProps {
  labels: string[];
  series: Series[];
  /** Stack the series within each label instead of grouping them. Only
   *  meaningful with two or more series. */
  stacked?: boolean;
  horizontal?: boolean;
  formatValue?: (value: number) => string;
  /** Print the total at the end of each bar. Worth it for ranked lists;
   *  noise on a 30-bucket time series. */
  showValues?: boolean;
  className?: string;
}

const GAP = 2; // surface-coloured gap between stacked segments

export function BarChart({
  labels,
  series,
  stacked = false,
  horizontal = false,
  formatValue = compact,
  showValues = false,
  className = '',
}: BarChartProps) {
  const { tooltip, setTooltip, hide } = useChartTooltip();
  const [hovered, setHovered] = useState<number | null>(null);

  const totals = useMemo(
    () => labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)),
    [labels, series],
  );

  const max = useMemo(() => {
    const peak = stacked
      ? Math.max(...totals, 1)
      : Math.max(1, ...series.flatMap((s) => s.values));
    return niceMax(peak);
  }, [stacked, totals, series]);

  if (labels.length === 0 || series.length === 0) {
    return <div className={`skeleton ${className}`} style={{ height: 240 }} />;
  }

  const tooltipFor = (index: number) => ({
    heading: labels[index] ?? '',
    rows: series
      .map((s, si) => ({
        key: s.key,
        label: s.label,
        value: formatValue(s.values[index] ?? 0),
        color: s.color ?? seriesColor(si),
      }))
      .filter((_, si) => (series[si]?.values[index] ?? 0) > 0 || series.length === 1),
  });

  /* ─── Horizontal ─────────────────────────────────────────────────────── */
  if (horizontal) {
    return (
      <div className={`flex flex-col gap-2.5 ${className}`}>
        {labels.map((label, i) => {
          const total = totals[i] ?? 0;
          return (
            <div
              key={label}
              className="relative"
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
            >
              {/* Anchored to its own row rather than to the chart box: a
                  ranked list has no shared plot area to position against. */}
              {hovered === i && series.length > 1 && (
                <div className="chart-tooltip absolute right-0 -top-1 z-10 whitespace-nowrap">
                  <TooltipRows {...tooltipFor(i)} />
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                {showValues && (
                  <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                    {formatValue(total)}
                  </span>
                )}
              </div>
              <div className="flex h-2.5 w-full overflow-hidden" style={{ borderRadius: 4, background: 'var(--color-surface-3)', gap: GAP }}>
                {series.map((s, si) => {
                  const value = s.values[i] ?? 0;
                  if (value <= 0) return null;
                  return (
                    <div
                      key={s.key}
                      style={{
                        width: `${(value / max) * 100}%`,
                        background: s.color ?? seriesColor(si),
                        borderRadius: 4,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        <ChartLegend series={series} />
      </div>
    );
  }

  /* ─── Vertical (grouped or stacked) ──────────────────────────────────── */
  const W = 600;
  const H = 240;
  const PAD = { top: 14, right: 8, bottom: 28, left: 42 };
  const PLOT_W = W - PAD.left - PAD.right;
  const PLOT_H = H - PAD.top - PAD.bottom;

  const slot = PLOT_W / labels.length;
  const barWidth = stacked ? Math.min(28, slot * 0.62) : Math.min(18, (slot * 0.62) / series.length);
  const labelStride = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" style={{ overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + PLOT_H * (1 - t);
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">
                {formatValue(max * t)}
              </text>
            </g>
          );
        })}

        {labels.map((label, i) => {
          const slotX = PAD.left + i * slot;
          const centre = slotX + slot / 2;
          let cursorY = PAD.top + PLOT_H;

          return (
            <g key={label + i}>
              {series.map((s, si) => {
                const value = s.values[i] ?? 0;
                const h = (value / max) * PLOT_H;
                if (h <= 0) return null;

                const color = s.color ?? seriesColor(si);

                if (stacked) {
                  // The 2px gap is surface, not a stroke: it keeps two
                  // adjacent segments from reading as one long block.
                  const y = cursorY - h;
                  cursorY = y - GAP;
                  return (
                    <rect key={s.key} x={centre - barWidth / 2} y={y} width={barWidth} height={Math.max(1, h - GAP)} rx={3} fill={color} />
                  );
                }

                const groupWidth = barWidth * series.length + GAP * (series.length - 1);
                const x = centre - groupWidth / 2 + si * (barWidth + GAP);
                return <rect key={s.key} x={x} y={PAD.top + PLOT_H - h} width={barWidth} height={h} rx={3} fill={color} />;
              })}

              {/* Column-wide hit target */}
              <rect
                x={slotX}
                y={PAD.top}
                width={slot}
                height={PLOT_H}
                fill="transparent"
                onPointerEnter={() => setTooltip({ x: (centre / W) * 100, y: 20, content: <TooltipRows {...tooltipFor(i)} /> })}
                onPointerLeave={hide}
              />

              {(i % labelStride === 0 || i === labels.length - 1) && (
                <text x={centre} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <ChartTooltip tooltip={tooltip} />
      <ChartLegend series={series} />
    </div>
  );
}
