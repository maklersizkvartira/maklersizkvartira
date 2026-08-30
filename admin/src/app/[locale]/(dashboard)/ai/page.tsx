'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bot, ChevronRight } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api, type PaginationParams } from '@/shared/api/endpoints';
import type { AdminAiSessionRow } from '@/shared/api/types';
import { shortId } from '@/shared/lib/mask';
import { useAdminList, type AdminFilters } from '@/shared/hooks/useAdminList';
import { PageHeader } from '@/shared/ui/PageHeader';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { AiTranscriptSheet } from '@/features/ai/components/AiTranscriptSheet';

/**
 * Conversations the public site's Uyiz AI assistant has held.
 *
 * `GET /admin/ai/sessions` is pagination and nothing else — no search, no date
 * range, no filter by user — so this page has no FilterBar. An empty one would
 * only promise a search the API cannot run.
 *
 * The transcript opens from a row rather than a route because this workstream
 * owns `/ai` and not `/ai/[id]`; the sheet reads the same on a phone as a
 * pushed screen would, and keeps the reader's place in the list underneath.
 */

const PAGE_SIZE = 25;

export default function AiPage() {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  const locale = useLocale();

  const [selected, setSelected] = useState<AdminAiSessionRow | null>(null);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  );

  const list = useAdminList<AdminAiSessionRow, AdminFilters>({
    queryKey: ['ai-sessions'],
    fetcher: async ({ page, signal }) => {
      const params: PaginationParams = { page, pageSize: PAGE_SIZE };
      const { data, meta } = await http.page<AdminAiSessionRow>(api.ai.sessions(params), {
        signal,
      });
      return { rows: data, meta };
    },
  });

  const columns: Column<AdminAiSessionRow>[] = [
    {
      key: 'sessionKey',
      header: t('columns.session'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs" style={{ color: 'var(--color-text-primary)' }}>
            {shortId(row.sessionKey)}
          </p>
          {row.summary && (
            <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
              {row.summary}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'user',
      header: t('columns.user'),
      // `guestLabel` is set instead of `userName` when nobody was signed in.
      render: (row) => row.userName ?? row.guestLabel ?? c('unknown'),
    },
    {
      key: 'messageCount',
      header: t('columns.messages'),
      align: 'right',
    },
    {
      key: 'createdAt',
      header: t('columns.started'),
      render: (row) => timeFormat.format(new Date(row.createdAt)),
    },
    {
      key: 'closedAt',
      // The row carries no "last message at"; `closedAt` is the only later
      // timestamp on it, and an open conversation has none yet.
      header: t('columns.lastActivity'),
      render: (row) => (row.closedAt ? timeFormat.format(new Date(row.closedAt)) : c('never')),
    },
    {
      key: 'open',
      header: t('viewMessages'),
      align: 'right',
      width: '48px',
      // Desktop-only affordance: below lg the whole card is already the button.
      hideOnCard: true,
      render: () => (
        <ChevronRight size={15} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* A refetch that fails leaves the previous page on screen and says
          nothing — `keepPreviousData` holds those rows. The empty-state
          branch below never runs in that case, so the warning goes here. */}
      <ListErrorBanner
        error={list.rows.length > 0 ? list.error : null}
        title={c('error')}
        retryLabel={c('retry')}
        onRetry={list.refetch}
      />

      <div
        style={{
          opacity: list.isFetching && !list.isLoading ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <DataTable
          columns={columns}
          rows={list.rows}
          keyOf={(row) => row.id}
          loading={list.isLoading}
          loadingRows={PAGE_SIZE}
          onRowClick={(row) => setSelected(row)}
          empty={
            <ListState
              icon={<Bot size={26} />}
              emptyTitle={c('noData')}
              errorTitle={c('error')}
              retryLabel={c('retry')}
              error={list.error}
              onRetry={list.refetch}
            />
          }
        />
      </div>

      <Pagination
        meta={list.meta}
        onPage={list.setPage}
        summary={(page, total) => c('pagination.pageOf', { page, total })}
        navLabel={c('pagination.label')}
        previousLabel={c('pagination.previousPage')}
        nextLabel={c('pagination.nextPage')}
      />

      <AiTranscriptSheet session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
