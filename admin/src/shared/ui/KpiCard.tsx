'use client';

import { type ReactNode } from 'react';

interface KpiCardProps {
  icon: ReactNode;
  iconBg?: string;    // optional style/class override
  iconColor?: string; // optional style/class override
  label: string;
  value: string | number;
  change?: number;       // percentage, positive or negative
  /**
   * Translated caption under the delta, e.g. "so'nggi 7 kunga nisbatan".
   * This used to be an English literal built in here, which no amount of
   * locale switching could reach — the caller has the `t` function, so the
   * caller supplies the sentence.
   */
  changeLabel?: string;
  loading?: boolean;
}

export function KpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  change,
  changeLabel,
  loading = false,
}: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0;

  if (loading) {
    return (
      <div className="card p-5 flex flex-col gap-3">
        <div className="skeleton h-10 w-10 rounded-[var(--radius-md)]" />
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-7 w-32 rounded" />
        <div className="skeleton h-3 w-28 rounded" />
      </div>
    );
  }

  return (
    <div className="card h-full w-full p-5 flex flex-col animate-fade-in justify-between">
      <div>
        {/* Icon */}
        <div 
          className={`w-10 h-10 rounded-[var(--radius-md)] flex-center mb-3 ${iconBg || ''}`}
          style={!iconBg ? { background: 'var(--accent-subtle)', color: 'var(--accent)' } : undefined}
        >
          <span className={`w-5 h-5 flex-center ${iconColor || ''}`}>{icon}</span>
        </div>

        {/* Label */}
        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{label}</p>

        {/* Value */}
        <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
          {value}
        </p>
      </div>

      {/* Change */}
      {change !== undefined && (
        <p
          className={`text-xs font-medium flex items-center gap-1 ${
            isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}
        >
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(change)}%</span>
          {changeLabel && <span style={{ color: 'var(--color-text-muted)' }}>{changeLabel}</span>}
        </p>
      )}
    </div>
  );
}
