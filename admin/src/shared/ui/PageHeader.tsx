'use client';

import { type ReactNode } from 'react';

/**
 * The top of every admin page. Twelve pages sharing one component is the whole
 * point — title size, subtitle colour and the gap before the content stay
 * identical, so moving between Listings and Audit never feels like moving
 * between two apps.
 *
 * On narrow screens the actions wrap under the title instead of squeezing it:
 * a "Create" button that shrinks the page title to three characters is worse
 * than a button on its own line.
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** 40px accent tile before the title — the page mark. */
  icon?: ReactNode;
  /** Buttons, filters, anything trailing. Right-aligned from sm up. */
  actions?: ReactNode;
  /** Breadcrumb / back link, rendered above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, eyebrow, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className="flex-shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div
              className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="text-xl font-bold leading-tight truncate"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}
