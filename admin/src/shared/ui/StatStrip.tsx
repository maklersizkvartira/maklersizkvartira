'use client';

import type { CSSProperties, ReactNode } from 'react';

export interface StatStripItem {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

/**
 * Clean, full-width grid of dashboard-style metrics cards.
 * Spreads out evenly across the container (1 column on narrow phones, 2 up to the
 * desktop breakpoint, dynamic columns on desktop).
 * Retains high-end dashboard hover-glow effects, border highlights, and icon transitions.
 */
export function StatStrip({ items }: { items: StatStripItem[] }) {
  return (
    <div
      className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-[var(--stat-cols)]"
      style={{ ['--stat-cols']: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` } as CSSProperties}
    >
      {items.map((item, i) => {
        return (
          <div
            key={i}
            className="group card flex p-5 items-center justify-between transition-all duration-200 relative overflow-hidden hover:border-[var(--accent)] hover:shadow-card-hover animate-fade-in-up"
            style={{
              animationDelay: `${i * 40}ms`,
              background: 'var(--color-surface)',
            }}
          >
            {/* Hover Glowing Background */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
              style={{
                background: 'radial-gradient(circle at top right, var(--accent-subtle), transparent 60%)',
              }}
            />

            {/* Left Column: Text metrics */}
            <div className="space-y-1.5 flex-1 min-w-0 relative">
              <p
                className="text-xs font-medium uppercase truncate"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {item.label}
              </p>
              <h3
                className="font-bold leading-none tracking-tight mt-1 truncate text-lg lg:text-2xl"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.04em' }}
              >
                {item.value}
              </h3>
            </div>

            {/* Right Column: Interactive Icon Tile */}
            <div
              className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-all duration-200 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-subtle)] relative"
            >
              <span className="flex items-center justify-center w-[18px] h-[18px]">
                {item.icon}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
