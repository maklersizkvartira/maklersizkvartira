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
  /** Buttons, filters, anything trailing. Right-aligned from sm up. */
  actions?: ReactNode;
  /** Breadcrumb / back link, rendered above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, eyebrow, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
            {eyebrow}
          </div>
        )}
        <h1
          className="text-[22px] sm:text-[26px] font-bold leading-tight truncate"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em', fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}
