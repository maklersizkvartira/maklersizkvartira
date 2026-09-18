'use client';

/**
 * The pill tabs a hub page switches between: SotuvchiAi's filter pills
 * (`h-8 px-3 rounded-full`, accent when active, count chip) lifted from its
 * clients page and given a single home, so every hub — listings, users,
 * conversations, notifications, system, settings — draws the same row.
 *
 * The active tab is mirrored into `?tab=` so a link from an alert or a
 * bookmark opens the hub on the right tab, and the browser's back button
 * walks between tabs the way it walks between the pages they replaced.
 */

import React, { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/shared/lib/cn';

export interface PageTab<K extends string = string> {
  key: K;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface PageTabsProps<K extends string> {
  tabs: PageTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  'aria-label'?: string;
}

export function PageTabs<K extends string>({ tabs, value, onChange, className, ...rest }: PageTabsProps<K>) {
  return (
    <div role="tablist" aria-label={rest['aria-label']} className={cn('flex flex-wrap items-center gap-2', className)}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              'focus:outline-none focus:ring-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors duration-150',
              active
                ? 'text-white'
                : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]',
            )}
            style={active ? { background: 'var(--accent)' } : undefined}
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className={cn(
                  'text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex-center',
                  active ? 'bg-white/20' : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * `?tab=` as state. The hub passes its tab keys and a default; the hook
 * returns the current tab (falling back to the default for an unknown or
 * absent value) and a setter that rewrites the query without a scroll jump.
 */
export function useTabParam<K extends string>(keys: readonly K[], fallback: K, initial?: K): [K, (key: K) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const raw = search.get('tab');
  const current = (keys as readonly string[]).includes(raw ?? '') ? (raw as K) : (initial ?? fallback);

  const setTab = useCallback(
    (key: K) => {
      const next = new URLSearchParams(search.toString());
      if (key === fallback) next.delete('tab');
      else next.set('tab', key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, search, fallback],
  );

  return [current, setTab];
}

export default PageTabs;
