'use client';

import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /**
   * 'danger' tints the icon box red. It is the only thing separating "nothing
   * matched" from "the request failed" at a glance — the two states are
   * otherwise the same shape, and a moderator who reads a failure as an empty
   * queue closes the tab.
   */
  tone?: 'neutral' | 'danger';
}

const sizeMap = {
  sm: { icon: '48px', padding: '32px 16px' },
  md: { icon: '64px', padding: '48px 24px' },
  lg: { icon: '80px', padding: '64px 32px' },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  tone = 'neutral',
}: EmptyStateProps) {
  const dims = sizeMap[size];
  const danger = tone === 'danger';

  return (
    <div
      className="flex flex-col items-center justify-center text-center animate-fade-in"
      style={{ padding: dims.padding, gap: '16px' }}
    >
      {icon && (
        <div
          className="flex-center flex-shrink-0"
          style={{
            width: dims.icon,
            height: dims.icon,
            borderRadius: 'var(--radius-xl)',
            background: danger ? 'var(--color-danger-bg)' : 'var(--color-surface-2)',
            border: `1px solid ${danger ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
            color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)',
          }}
        >
          {icon}
        </div>
      )}

      <div style={{ maxWidth: '360px' }}>
        <p
          className="font-bold mb-1.5"
          style={{
            color: 'var(--color-text-primary)',
            fontSize: size === 'lg' ? '18px' : '15px',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </p>
        {description && (
          <p
            className="text-sm"
            style={{
              color: 'var(--color-text-muted)',
              lineHeight: '1.65',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-1">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
