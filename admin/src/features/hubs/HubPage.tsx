'use client';

/**
 * The hub: one heading, one row of pill tabs, one body.
 *
 * Eighteen sidebar entries became nine of these. A hub keeps the pages it
 * replaced as its tabs — each page component takes `embedded` and renders
 * without its own heading — and mirrors the open tab into `?tab=`, so the
 * old address of a page (`/reports`, `/sms`, …) still lands on it, and the
 * alerts that link there keep working.
 *
 * The composition is SotuvchiAi's list page: `space-y-6`, PageHeader with
 * an icon tile, the pill row, then the content. A tab may be dropped by
 * the caller (role gating) and the row simply shrinks.
 */

import React from 'react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { PageTabs, useTabParam, type PageTab } from '@/shared/ui/PageTabs';

export interface HubTab<K extends string = string> extends PageTab<K> {
  body: React.ReactNode;
}

export interface HubPageProps<K extends string> {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tabs: HubTab<K>[];
  /** The tab an old route wants opened; `?tab=` still wins when present. */
  initialTab?: K;
}

export function HubPage<K extends string>({ icon, title, subtitle, actions, tabs, initialTab }: HubPageProps<K>) {
  const keys = tabs.map((tab) => tab.key);
  const fallback = keys[0];
  const [tab, setTab] = useTabParam<K>(keys, fallback, initialTab && keys.includes(initialTab) ? initialTab : undefined);
  const active = tabs.find((item) => item.key === tab) ?? tabs[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
      {tabs.length > 1 && <PageTabs tabs={tabs} value={active.key} onChange={setTab} aria-label={title} />}
      <div key={active.key} className="animate-fade-in">
        {active.body}
      </div>
    </div>
  );
}

export default HubPage;
