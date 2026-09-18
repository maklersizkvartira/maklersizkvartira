'use client';

/**
 * /conversations — the support desk and the AI desk as two tabs of one
 * page. The old /support and /chat addresses mount this with their tab
 * preselected, so the Telegram alerts that deep-link there keep landing on
 * the right thread list.
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Headphones, MessagesSquare } from 'lucide-react';

import { HubPage } from '@/features/hubs/HubPage';
import { SupportDesk } from './SupportDesk';
import { AiDesk } from './AiDesk';

export type ConversationsTab = 'support' | 'ai';

export function ConversationsHub({ initialTab }: { initialTab?: ConversationsTab }) {
  const t = useTranslations('hubs.conversations');
  return (
    <HubPage<ConversationsTab>
      icon={<MessagesSquare size={18} />}
      title={t('title')}
      subtitle={t('subtitle')}
      initialTab={initialTab}
      tabs={[
        { key: 'support', label: t('tabs.support'), icon: <Headphones size={13} />, body: <SupportDesk /> },
        { key: 'ai', label: t('tabs.ai'), icon: <Bot size={13} />, body: <AiDesk /> },
      ]}
    />
  );
}

export default ConversationsHub;
