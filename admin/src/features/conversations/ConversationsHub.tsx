'use client';

/**
 * /conversations — one "Murojaatlar" card. The list's pills are the three
 * support statuses plus "AI": picking AI swaps the desk underneath for the
 * assistant's sessions (with its own sub-filters), picking a status swaps it
 * back with that status applied. No page-level tabs — the card is the page.
 *
 * `?tab=ai` (and the old /chat address) still opens the AI desk directly, so
 * the Telegram alerts that deep-link there keep landing on the right list.
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessagesSquare } from 'lucide-react';

import { PageHeader } from '@/shared/ui/PageHeader';
import { useTabParam } from '@/shared/ui/PageTabs';
import { SupportDesk, type StatusFilter } from './SupportDesk';
import { AiDesk } from './AiDesk';

export type ConversationsTab = 'support' | 'ai';

const STATUSES: StatusFilter[] = ['ALL', 'OPEN', 'RESOLVED'];

export function ConversationsHub({ initialTab }: { initialTab?: ConversationsTab }) {
  const t = useTranslations('hubs.conversations');
  const s = useTranslations('support');
  const [mode, setMode] = useTabParam<ConversationsTab>(['support', 'ai'], 'support', initialTab);
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const sourceTabs = [
    { key: 'ALL', label: s('all') },
    { key: 'OPEN', label: s('open') },
    { key: 'RESOLVED', label: s('resolved') },
    { key: 'AI', label: s('aiTab') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader icon={<MessagesSquare size={18} />} title={t('title')} subtitle={t('subtitle')} />
      {mode === 'ai' ? (
        <AiDesk
          key="ai"
          listTitle={s('listTitle')}
          sourceTabs={sourceTabs}
          onSource={(key) => {
            if (STATUSES.includes(key as StatusFilter)) {
              setStatus(key as StatusFilter);
              setMode('support');
            }
          }}
        />
      ) : (
        <SupportDesk
          key={`support-${status}`}
          initialStatus={status}
          onOpenAi={(current) => {
            setStatus(current);
            setMode('ai');
          }}
        />
      )}
    </div>
  );
}

export default ConversationsHub;
