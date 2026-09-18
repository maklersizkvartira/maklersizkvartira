'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Settings, SlidersHorizontal } from 'lucide-react';

import { HubPage } from '@/features/hubs/HubPage';
import { SettingsBody } from '@/app/[locale]/(dashboard)/settings/page';

type Tab = 'general';

export function SettingsHub({ initialTab }: { initialTab?: Tab }) {
  const t = useTranslations('hubs.settings');
  return (
    <HubPage<Tab>
      icon={<Settings size={18} />}
      title={t('title')}
      subtitle={t('subtitle')}
      initialTab={initialTab}
      tabs={[
        { key: 'general', label: t('tabs.general'), icon: <SlidersHorizontal size={13} />, body: <SettingsBody embedded /> },
      ]}
    />
  );
}
