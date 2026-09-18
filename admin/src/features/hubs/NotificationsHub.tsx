'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellRing, MessageSquareText } from 'lucide-react';

import { HubPage, type HubTab } from '@/features/hubs/HubPage';
import { useRole } from '@/providers/role-provider';
import { atLeast, ROUTE_MIN_ROLE } from '@/shared/lib/permissions';
import { PushScreen } from '@/features/push/components/PushScreen';
import { SmsScreen } from '@/features/sms/components/SmsScreen';

type Tab = 'push' | 'sms';

export function NotificationsHub({ initialTab }: { initialTab?: Tab }) {
  const t = useTranslations('hubs.notifications');
  const { role } = useRole();
  const tabs: HubTab<Tab>[] = [
    { key: 'push', label: t('tabs.push'), icon: <BellRing size={13} />, body: <PushScreen embedded /> },
  ];
  // The SMS log carries phone numbers and is ADMIN on the backend; a
  // moderator gets no tab rather than a tab that 403s.
  if (atLeast(role, ROUTE_MIN_ROLE['/sms'] ?? 'ADMIN')) {
    tabs.push({ key: 'sms', label: t('tabs.sms'), icon: <MessageSquareText size={13} />, body: <SmsScreen embedded /> });
  }
  return (
    <HubPage<Tab> icon={<Bell size={18} />} title={t('title')} subtitle={t('subtitle')} initialTab={initialTab} tabs={tabs} />
  );
}
