'use client';

/**
 * The counter row a list hub opens with, fed by the one `GET /admin/stats`
 * call the dashboard already polls — so the strip shares its cache and the
 * numbers on the hub match the numbers on the home page.
 *
 * Each hub picks its six counters; while the query is in flight the values
 * render as a pulse bar of the same height, so the table below does not
 * jump when the figures arrive.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminStats } from '@/shared/api/types';
import { StatStrip, type StatStripItem } from '@/shared/ui/StatStrip';

const STATS_POLL_MS = 60_000;

export interface HubStatSpec {
  key: keyof AdminStats;
  label: string;
  icon: React.ReactNode;
  tone?: StatStripItem['tone'];
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => http.get<AdminStats>(api.stats, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function HubStats({ specs }: { specs: HubStatSpec[] }) {
  const stats = useAdminStats();
  const items: StatStripItem[] = specs.map((spec) => ({
    label: spec.label,
    icon: spec.icon,
    tone: spec.tone,
    value: stats.data ? (
      stats.data[spec.key].toLocaleString()
    ) : (
      <span className="inline-block h-6 w-14 animate-pulse rounded-md bg-[var(--color-surface-2)] align-middle" />
    ),
  }));
  return (
    <div className="mb-5">
      <StatStrip items={items} />
    </div>
  );
}

export default HubStats;
