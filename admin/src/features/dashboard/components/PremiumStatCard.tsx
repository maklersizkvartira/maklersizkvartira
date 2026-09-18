'use client';

/**
 * The KPI card SotuvchiAi's dashboard opens with, ported for the admin.
 *
 * `.card p-5` with an accent-subtle radial glow that fades in on hover; the
 * first card of a row takes `variant="hero"` — the brand gradient with white
 * type and a lifted accent shadow — so the one number the page is about
 * reads as its headline. The value counts up on mount (`AnimatedCounter`),
 * and `TrendBadge` prints a signed percentage next to a suffix for cards
 * that have a period comparison. `href` makes the whole card a link.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export function AnimatedCounter({
  value,
  duration = 1200,
  format,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let frame = 0;
    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = progress * (2 - progress);
      setCount(Math.floor(eased * value));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span>{format ? format(count) : count.toLocaleString()}</span>;
}

export function TrendBadge({ pct, suffix }: { pct: number; suffix: string }) {
  const isUp = pct >= 0;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span
        className="font-bold inline-flex items-center gap-0.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        style={{ color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}
      >
        <Icon size={11} /> {isUp ? '+' : ''}
        {pct}%
      </span>
      <span style={{ color: 'var(--color-text-muted)' }}>{suffix}</span>
    </>
  );
}

export interface PremiumStatCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  href?: string;
  loading?: boolean;
  variant?: 'default' | 'hero';
  className?: string;
}

export function PremiumStatCard({
  label,
  value,
  sublabel,
  icon,
  href,
  loading,
  variant = 'default',
  className = '',
}: PremiumStatCardProps) {
  const isHero = variant === 'hero';

  const content = (
    <div
      className={`group p-5 flex items-center justify-between transition-all duration-200 relative overflow-hidden h-full ${
        isHero
          ? 'rounded-[var(--radius-lg)] hover:-translate-y-0.5'
          : 'card card-hover'
      } ${className}`}
      style={
        isHero
          ? {
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
              boxShadow: '0 16px 40px -14px rgba(var(--accent-rgb), 0.5)',
            }
          : undefined
      }
    >
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          isHero ? '' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{
          background: isHero
            ? 'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 60%)'
            : 'radial-gradient(circle at top right, var(--accent-subtle), transparent 60%)',
        }}
      />

      <div className="space-y-2 flex-1 min-w-0 relative">
        <p
          className="text-xs font-medium uppercase"
          style={{ color: isHero ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)' }}
        >
          {label}
        </p>

        {loading ? (
          <div
            className={`h-7 w-28 animate-pulse rounded-lg mt-1 ${
              isHero ? 'bg-white/20' : 'bg-[var(--color-surface-2)]'
            }`}
          />
        ) : (
          <h3
            className={`font-bold leading-none tracking-tight mt-1 truncate ${isHero ? 'text-3xl' : 'text-2xl'}`}
            style={{
              color: isHero ? '#ffffff' : 'var(--color-text-primary)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-0.04em',
            }}
          >
            {value}
          </h3>
        )}

        {sublabel && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs">
            {isHero ? (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--color-text-primary)' }}
              >
                {sublabel}
              </span>
            ) : (
              sublabel
            )}
          </div>
        )}
      </div>

      {icon && (
        <div
          className={`rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-all duration-200 ${
            isHero
              ? 'w-11 h-11 bg-white/15 text-white'
              : 'w-9 h-9 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent-border)] group-hover:bg-[var(--accent-subtle)]'
          }`}
        >
          <span className={`flex items-center justify-center ${isHero ? 'w-[18px] h-[18px]' : 'w-4 h-4'}`}>{icon}</span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

/**
 * The header SotuvchiAi puts on every bento card: a 40px accent icon tile,
 * a bold heading in the display face and a muted one-line subtitle, with an
 * optional action slot on the right.
 */
export function CardHeader({
  icon,
  title,
  subtitle,
  action,
  className = '',
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3
            className="text-base font-bold truncate"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
