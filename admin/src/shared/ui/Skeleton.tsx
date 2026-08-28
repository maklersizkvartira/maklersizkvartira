'use client';

/**
 * Loading placeholder over the shared `.skeleton` shimmer in globals.css —
 * one shimmer definition, so every loading surface in the panel breathes at
 * the same rate instead of each page inventing its own grey box.
 */

interface SkeletonProps {
  /** Any CSS length; numbers are treated as px. Defaults to filling the row. */
  width?: string | number;
  height?: string | number;
  /** Any CSS radius; defaults to --radius-md via the .skeleton class. */
  radius?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = 14, radius, className = '' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton block ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...(radius ? { borderRadius: radius } : {}),
      }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** A paragraph-shaped stack. The last line is short so the block reads as
 *  prose rather than as a table. */
export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} radius="var(--radius-xs)" />
      ))}
    </div>
  );
}
