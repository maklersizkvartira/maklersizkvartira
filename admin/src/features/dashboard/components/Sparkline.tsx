'use client';

import { useId } from 'react';

/**
 * A shape, not a chart: no axis, no gridlines, no tooltip, no hover.
 *
 * It exists so a bare integer — "412 visitors today" — finally says whether
 * that is a good day or a bad one, using a series the page has already
 * fetched for the trend card. Zero extra network cost, one extra dimension.
 *
 * The viewBox is stretched (`preserveAspectRatio="none"`) so no resize
 * observer is needed for a decorative 30px strip; `vectorEffect` keeps the
 * stroke a true 1.8px despite the horizontal stretch. That trade is fine here
 * and wrong for the real charts, which is why LineChart measures instead.
 */

interface SparklineProps {
  values: number[];
  height?: number;
  className?: string;
}

/**
 * Catmull-Rom control points at tension 6, emitted as cubic Béziers. The
 * curve passes exactly through every data point, so it can look organic and
 * still be honest about the numbers.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';

  let d = `M${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function Sparkline({ values, height = 30, className = '' }: SparklineProps) {
  const gradientId = useId().replace(/:/g, '');

  // A single point is not a trend. Drawing a flat line through it would be an
  // invented shape, and rendering nothing keeps the card from jumping later.
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((value, i) => ({
    x: (i / (values.length - 1)) * 100,
    // 8/8 vertical padding so a peak or a trough is never clipped.
    y: 8 + (1 - (value - min) / span) * 84,
  }));

  const line = smoothPath(points);
  const area = `${line} L100 100 L0 100 Z`;

  return (
    <span className={`relative block w-full ${className}`} style={{ height }} aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ color: 'var(--chart-1)' }}
      >
        <defs>
          <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#spark-${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
