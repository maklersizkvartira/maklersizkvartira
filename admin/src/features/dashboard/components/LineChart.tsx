'use client';

import { useId, useMemo } from 'react';
import {
  ChartLegend,
  ChartTooltip,
  TooltipRows,
  compact,
  niceMax,
  seriesColor,
  useChartTooltip,
  CHART_BODY_CLASS,
  type Series,
} from './chart-shared';
import { useChartSize } from '@/features/dashboard/hooks/use-chart-size';

/**
 * Multi-series line, with an optional area fill when there is exactly one
 * series. Covers both time charts on the dashboard: registrations, and
 * traffic (visitors + views).
 *
 * One y-scale, always. Two measures of wildly different magnitude get two
 * charts, never a second axis — a dual axis lets the author decide where the
 * lines cross, which is a decision the data should be making.
 *
 * The plot is drawn at one SVG unit per CSS pixel, from a measured box, so a
 * 10px axis label is 10px on a phone as well as on a desktop. It used to be a
 * fixed 600x240 viewBox scaled into whatever width the card had, which on a
 * 343px phone card rendered those labels at roughly 5.7px.
 */

interface LineChartProps {
  /** X labels, one per data point. */
  labels: string[];
  series: Series[];
  /** Fill under the line. Only honoured for a single series — overlapping
   *  translucent fills muddy every colour underneath them. */
  area?: boolean;
  /** Override the value formatting in the tooltip (units, currency, …). */
  formatValue?: (value: number) => string;
  className?: string;
}

export function LineChart({ labels, series, area = false, formatValue = compact, className = '' }: LineChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const { tooltip, setTooltip, hide } = useChartTooltip();
  const { ref, box } = useChartSize();

  const max = useMemo(
    () => niceMax(Math.max(1, ...series.flatMap((s) => s.values))),
    [series],
  );

  if (labels.length === 0 || series.length === 0) {
    return <div className={`skeleton ${CHART_BODY_CLASS} ${className}`} />;
  }

  const W = box.width;
  const H = box.height;
  // The left gutter only has to hold an abbreviated axis value; on a narrow
  // phone the 46px desktop gutter costs more plot than the digits need.
  const PAD = { top: 16, right: 16, bottom: 26, left: W < 480 ? 34 : 46 };
  const PLOT_W = Math.max(1, W - PAD.left - PAD.right);
  const PLOT_H = Math.max(1, H - PAD.top - PAD.bottom);

  const stepX = labels.length > 1 ? PLOT_W / (labels.length - 1) : 0;
  const xAt = (i: number) => PAD.left + i * stepX;
  const yAt = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  // Past this the x labels collide and the reader loses more than the extra
  // ticks give back. Four on a phone, six from 480px up.
  const maxLabels = W < 480 ? 4 : 6;
  const labelStride = Math.max(1, Math.ceil(labels.length / maxLabels));

  const showArea = area && series.length === 1;

  return (
    <div className={className}>
      <div ref={ref} className={`relative w-full ${CHART_BODY_CLASS}`}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          style={{ overflow: 'visible' }}
        >
          {showArea && (
            <defs>
              <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series[0]?.color ?? seriesColor(0)} stopOpacity={0.22} />
                <stop offset="100%" stopColor={series[0]?.color ?? seriesColor(0)} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}

          {/* Grid — recessive: it orients, it does not compete with the data. */}
          {yTicks.map((t) => {
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

          {labels.map((label, i) =>
            i % labelStride === 0 || i === labels.length - 1 ? (
              <text key={label + i} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">
                {label}
              </text>
            ) : null,
          )}

          {showArea && series[0] && (
            <polygon
              fill={`url(#area-${gradientId})`}
              points={[
                ...series[0].values.map((v, i) => `${xAt(i)},${yAt(v)}`),
                `${xAt(series[0].values.length - 1)},${PAD.top + PLOT_H}`,
                `${xAt(0)},${PAD.top + PLOT_H}`,
              ].join(' ')}
            />
          )}

          {series.map((s, si) => {
            const color = s.color ?? seriesColor(si);
            return (
              <g key={s.key}>
                <polyline
                  points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Markers only where the reader can use them; a dot per point
                    on a 90-day series is noise. */}
                {s.values.length <= 14 &&
                  s.values.map((v, i) => (
                    <circle
                      key={i}
                      cx={xAt(i)}
                      cy={yAt(v)}
                      r={4}
                      fill={color}
                      stroke="var(--color-surface)"
                      strokeWidth={2}
                    />
                  ))}
              </g>
            );
          })}

          {/* Crosshair for the hovered index */}
          {tooltip && (
            <line
              x1={(tooltip.x / 100) * W}
              x2={(tooltip.x / 100) * W}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--color-border-medium)"
              strokeWidth={1}
            />
          )}

          {/* Invisible hit layer — one full-height band per index, so the hover
              target is the column, not the 4px dot. */}
          {labels.map((label, i) => (
            <rect
              key={`hit-${label}-${i}`}
              x={xAt(i) - stepX / 2}
              y={PAD.top}
              width={stepX || PLOT_W}
              height={PLOT_H}
              fill="transparent"
              onPointerEnter={() =>
                setTooltip({
                  x: (xAt(i) / W) * 100,
                  y: 24,
                  content: (
                    <TooltipRows
                      heading={label}
                      rows={series.map((s, si) => ({
                        key: s.key,
                        label: s.label,
                        value: formatValue(s.values[i] ?? 0),
                        color: s.color ?? seriesColor(si),
                      }))}
                    />
                  ),
                })
              }
              onPointerLeave={hide}
            />
          ))}
        </svg>

        {/* Inside the plot box, so the tooltip's percentage coordinates mean
            percentages of the plot rather than of the plot plus its legend. */}
        <ChartTooltip tooltip={tooltip} />
      </div>

      <ChartLegend series={series} />
    </div>
  );
}
