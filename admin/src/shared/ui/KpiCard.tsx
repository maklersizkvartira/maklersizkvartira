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
        <div className="skeleton h-9 w-9 rounded-[var(--radius-md)]" />
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-6 w-28 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col gap-3 animate-fade-in">
      {/* Icon */}
      <div className={`w-9 h-9 rounded-[var(--radius-md)] flex-center flex-shrink-0 ${iconBg || 'icon-box-accent'}`}>
        <span className={`flex-center ${iconColor || ''}`} style={{ width: 16, height: 16 }}>
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {/* Label */}
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>

        {/* Value */}
        <p
          className="text-2xl font-bold leading-none tracking-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.04em' }}
        >
          {value}
        </p>
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <p
          className="text-xs font-medium flex items-center gap-1"
          style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}
        >
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(change)}%</span>
          {changeLabel && <span style={{ color: 'var(--color-text-muted)' }}>{changeLabel}</span>}
        </p>
      )}
    </div>
  );
}
