'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ScrollText, Shield, ShieldCheck, Users } from 'lucide-react';

import { HubPage, type HubTab } from '@/features/hubs/HubPage';
import { useRole } from '@/providers/role-provider';
import { atLeast, ROUTE_MIN_ROLE } from '@/shared/lib/permissions';
import AuditPage from '@/app/[locale]/(dashboard)/audit/page';
import { SecurityScreen } from '@/features/security/components/SecurityScreen';
import { StaffScreen } from '@/features/staff/components/StaffScreen';

type Tab = 'audit' | 'security' | 'staff';

export function SystemHub({ initialTab }: { initialTab?: Tab }) {
  const t = useTranslations('hubs.system');
  const { role } = useRole();
  const tabs: HubTab<Tab>[] = [
    { key: 'audit', label: t('tabs.audit'), icon: <ScrollText size={13} />, body: <AuditPage embedded /> },
  ];
  if (atLeast(role, ROUTE_MIN_ROLE['/security'] ?? 'ADMIN')) {
    tabs.push({ key: 'security', label: t('tabs.security'), icon: <ShieldCheck size={13} />, body: <SecurityScreen embedded /> });
  }
  if (atLeast(role, ROUTE_MIN_ROLE['/staff'] ?? 'SUPERADMIN')) {
    tabs.push({ key: 'staff', label: t('tabs.staff'), icon: <Users size={13} />, body: <StaffScreen embedded /> });
  }
  return (
    <HubPage<Tab> icon={<Shield size={18} />} title={t('title')} subtitle={t('subtitle')} initialTab={initialTab} tabs={tabs} />
  );
}
