'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Clock3, Flag, Flame, LayoutList, Star } from 'lucide-react';

import { HubPage, type HubTab } from '@/features/hubs/HubPage';
import { HubStats } from '@/features/hubs/HubStats';
import { ListingsScreen } from '@/features/listings/screens/ListingsScreen';
import { ReportsScreen } from '@/features/listings/screens/ReportsScreen';
import { TopRequestsScreen } from '@/features/listings/screens/TopRequestsScreen';

type Tab = 'listings' | 'reports' | 'top';

/**
 * Listings, reports and Top requests as one hub. The three pages all read
 * as "the moderation desk" — the same rows seen from three sides — so they
 * share a heading and a counter strip, and `/reports` and `/top-requests`
 * keep opening on their own tab.
 */
export function ListingsHub({ initialTab }: { initialTab?: Tab }) {
  const t = useTranslations('hubs.listings');
  const l = useTranslations('listings.stats');
  const tabs: HubTab<Tab>[] = [
    {
      key: 'listings',
      label: t('tabs.listings'),
      icon: <LayoutList size={13} />,
      body: (
        <>
          <HubStats
            specs={[
              { key: 'totalListings', label: l('total'), icon: <Building2 size={16} /> },
              { key: 'pendingListings', label: l('pending'), icon: <Clock3 size={16} />, tone: 'warning' },
              { key: 'featuredListings', label: l('featured'), icon: <Star size={16} />, tone: 'accent' },
              { key: 'openReports', label: l('openReports'), icon: <Flag size={16} />, tone: 'danger' },
            ]}
          />
          <ListingsScreen embedded />
        </>
      ),
    },
    { key: 'reports', label: t('tabs.reports'), icon: <Flag size={13} />, body: <ReportsScreen embedded /> },
    { key: 'top', label: t('tabs.topRequests'), icon: <Flame size={13} />, body: <TopRequestsScreen embedded /> },
  ];
  return (
    <HubPage<Tab> icon={<Building2 size={18} />} title={t('title')} subtitle={t('subtitle')} initialTab={initialTab} tabs={tabs} />
  );
}

export default ListingsHub;
