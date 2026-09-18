'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Settings, SlidersHorizontal } from 'lucide-react';

import { HubPage } from '@/features/hubs/HubPage';
import { SettingsBody } from '@/app/[locale]/(dashboard)/settings/page';
import AiPage from '@/app/[locale]/(dashboard)/ai/page';

type Tab = 'general' | 'ai';

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
        { key: 'ai', label: t('tabs.ai'), icon: <Bot size={13} />, body: <AiPage embedded /> },
      ]}
    />
  );
}
