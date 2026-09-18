'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Ban, UserPlus, Users } from 'lucide-react';

import { HubPage, type HubTab } from '@/features/hubs/HubPage';
import { HubStats } from '@/features/hubs/HubStats';
import { UsersScreen } from '@/features/users/screens/UsersScreen';
import { VerificationsScreen } from '@/features/users/screens/VerificationsScreen';

type Tab = 'users' | 'verifications';

/** Accounts and the document-verification queue as one hub; `/verifications` opens its tab. */
export function UsersHub({ initialTab }: { initialTab?: Tab }) {
  const t = useTranslations('hubs.users');
  const u = useTranslations('users.stats');
  const tabs: HubTab<Tab>[] = [
    {
      key: 'users',
      label: t('tabs.users'),
      icon: <Users size={13} />,
      body: (
        <>
          <HubStats
            specs={[
              { key: 'totalUsers', label: u('total'), icon: <Users size={16} /> },
              { key: 'weekNewUsers', label: u('weekNew'), icon: <UserPlus size={16} />, tone: 'success' },
              { key: 'suspendedUsers', label: u('suspended'), icon: <Ban size={16} />, tone: 'danger' },
              { key: 'pendingVerifications', label: u('pendingVerifications'), icon: <BadgeCheck size={16} />, tone: 'warning' },
            ]}
          />
          <UsersScreen embedded />
        </>
      ),
    },
    { key: 'verifications', label: t('tabs.verifications'), icon: <BadgeCheck size={13} />, body: <VerificationsScreen embedded /> },
  ];
  return (
    <HubPage<Tab> icon={<Users size={18} />} title={t('title')} subtitle={t('subtitle')} initialTab={initialTab} tabs={tabs} />
  );
}

export default UsersHub;
