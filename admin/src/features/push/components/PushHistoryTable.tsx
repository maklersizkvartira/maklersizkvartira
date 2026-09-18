'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { History, Bell, Home, Users, CheckCircle2, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PushHistoryItem } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';

interface PushHistoryTableProps {
  refreshTrigger?: number;
}

export function PushHistoryTable({ refreshTrigger = 0 }: PushHistoryTableProps) {
  const t = useTranslations('pushPage.history');

  const [page, setPage] = useState(1);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['push', 'history', page, refreshTrigger],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await http.get<{ items: PushHistoryItem[]; total: number } | PushHistoryItem[]>(
        api.push.history({ page, limit: 10 })
      );
      if (Array.isArray(res)) return { items: res, total: res.length };
      if (res && Array.isArray(res.items)) return { items: res.items, total: res.total || res.items.length };
      return { items: [], total: 0 };
    },
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const audienceLabels: Record<string, { label: string; color: string }> = {
    all: { label: 'Barcha foydalanuvchilar', color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
    students: { label: 'Talabalar', color: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    tenants: { label: 'Ijarachilar', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
    owners: { label: 'Uy egalari', color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
    specific: { label: 'Maxsus foydalanuvchi', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="card p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('title')}
            </h3>
            <p className="text-xs text-xs text-[var(--color-text-muted)]">
              Ilgari yuborilgan barcha xabarnomalar arxivi va yetkazilish natijalari
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          Jami: {total}
        </span>
      </div>

      {loading && items.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs">Yuklanmoqda...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <Bell className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-sm font-medium">{t('empty')}</p>
        </div>
      ) : (
        <div>
        <div className="data-table-wrap">
          <div className="data-table-scroll">
          <table className="data-table min-w-[700px]">
            <thead>
              <tr>
                <th>{t('tableTitle')}</th>
                <th>{t('tableTarget')}</th>
                <th>{t('tableListing')}</th>
                <th>{t('tableSentBy')}</th>
                <th>{t('tableDate')}</th>
                <th className="text-right">{t('tableStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const aud = audienceLabels[row.target_audience] || {
                  label: row.target_audience,
                  color: 'bg-slate-100 dark:bg-slate-800 text-slate-600',
                };
                return (
                  <tr
                    key={row.id}
                  >
                    {/* Message Title & Body */}
                    <td className="max-w-[280px]">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {row.title}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] line-clamp-2 mt-0.5">
                        {row.body}
                      </div>
                    </td>

                    {/* Audience */}
                    <td className="whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${aud.color}`}
                      >
                        <Users className="w-3 h-3 flex-shrink-0" />
                        {aud.label}
                      </span>
                    </td>

                    {/* Attached Listing */}
                    <td className="max-w-[180px]">
                      {row.listing_id ? (
                        <a
                          href={`https://uyiz.uz/?listing=${row.listing_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium hover:underline truncate"
                        >
                          <Home className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {row.listing_title || `Eʼlon #${row.listing_id.slice(0, 8)}`}
                          </span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Sent by */}
                    <td className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {row.sent_by || 'Admin'}
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {formatDate(row.created_at)}
                      </div>
                    </td>

                    {/* Status / Delivery */}
                    <td className="whitespace-nowrap text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {row.sent_count} ta qurilma
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div></div>

          {/* Pagination controls if needed */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Sahifa {page} / {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg h-8 px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg h-8 px-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
