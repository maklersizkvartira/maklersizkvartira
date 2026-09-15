'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  CreditCard,
  DollarSign,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpRight,
  ShieldCheck,
  Crown,
  Flame,
  Wallet,
} from 'lucide-react';

import { http } from '@/shared/lib/http';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Spinner } from '@/shared/ui/Spinner';

function formatNumber(num: number): string {
  return (num || 0).toLocaleString('uz-UZ');
}

interface PaymentRow {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  serviceType: string;
  clickTransId: string | null;
  clickPaydocId: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface PaymentStats {
  totalRevenue: number;
  verifiedUsersCount: number;
  vipListingsCount: number;
  topListingsCount: number;
}

export default function PaymentsPage() {
  const c = useTranslations('common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  // Fetch Stats
  const { data: statsData, isLoading: statsLoading } = useQuery<{ status: string } & PaymentStats>({
    queryKey: ['admin-payment-stats'],
    queryFn: () => http.get('/admin/payments/stats'),
  });

  // Fetch Payments List
  const { data: paymentsData, isLoading: listLoading, refetch } = useQuery<{
    status: string;
    data: PaymentRow[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['admin-payments', page, statusFilter, providerFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (statusFilter) params.set('status', statusFilter);
      if (providerFilter) params.set('provider', providerFilter);
      return http.get(`/admin/payments?${params.toString()}`);
    },
  });

  const columns: Column<PaymentRow>[] = [
    {
      key: 'user',
      header: 'Foydalanuvchi',
      render: (row) => (
        <div>
          <div className="font-bold text-sm text-[var(--color-text)]">{row.userName}</div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">{row.userPhone}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Summa',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
          +{formatNumber(row.amount)} {row.currency}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Xizmat turi',
      render: (row) => {
        let label = 'Hisob to‘ldirish';
        let badgeColor = 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400';
        if (row.serviceType === 'VERIFIED_BADGE') {
          label = 'Galochka (Verified)';
          badgeColor = 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400';
        } else if (row.serviceType === 'TOP_LISTING') {
          label = 'TOP E’lon';
          badgeColor = 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
        } else if (row.serviceType === 'VIP_LISTING') {
          label = 'VIP E’lon';
          badgeColor = 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400';
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
            {label}
          </span>
        );
      },
    },
    {
      key: 'provider',
      header: 'Tizim',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-[var(--color-text)]">
          <CreditCard className="w-3.5 h-3.5 text-blue-500" />
          {row.provider}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      render: (row) => {
        if (row.status === 'SUCCESS') {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" /> Muvaffaqiyatli
            </span>
          );
        }
        if (row.status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
              <Clock className="w-3.5 h-3.5" /> Kutilmoqda
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
            <XCircle className="w-3.5 h-3.5" /> Bekor qilingan
          </span>
        );
      },
    },
    {
      key: 'clickTransId',
      header: 'Click Trans ID',
      render: (row) => (
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {row.clickTransId || '—'}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Sana',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          {dateFormat.format(new Date(row.createdAt))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="To‘lovlar & Daromad boshqaruvi"
        subtitle="Click to‘lovlari, tushumlar, pullik xizmatlar va balans auditi"
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Jami Tushum (Click)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {statsLoading ? '...' : `${formatNumber(statsData?.totalRevenue ?? 0)} so‘m`}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Muvaffaqiyatli Click to‘lovlari</p>
        </div>

        {/* Verified Badges */}
        <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Galochka (Tasdiqlangan)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {statsLoading ? '...' : `${formatNumber(statsData?.verifiedUsersCount ?? 0)} ta`}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">20 000 so‘mlik rasmiy statuslar</p>
        </div>

        {/* TOP Listings */}
        <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              TOP E’lonlar
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {statsLoading ? '...' : `${formatNumber(statsData?.topListingsCount ?? 0)} ta`}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">7 000 so‘mlik ko‘tarilgan e’lonlar</p>
        </div>

        {/* VIP Listings */}
        <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              VIP E’lonlar
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {statsLoading ? '...' : `${formatNumber(statsData?.vipListingsCount ?? 0)} ta`}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">12 000 so‘mlik VIP e’lonlar</p>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        label="Filtrlar"
        resetLabel="Tozalash"
        activeCount={(statusFilter ? 1 : 0) + (providerFilter ? 1 : 0)}
        onReset={() => {
          setStatusFilter('');
          setProviderFilter('');
        }}
      >
        <Select
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          placeholder="To‘lov holati"
          options={[
            { value: '', label: 'Barcha holatlar' },
            { value: 'SUCCESS', label: 'Muvaffaqiyatli' },
            { value: 'PENDING', label: 'Kutilmoqda' },
            { value: 'FAILED', label: 'Bekor qilingan' },
          ]}
        />
        <Select
          value={providerFilter}
          onChange={(val) => {
            setProviderFilter(val);
            setPage(1);
          }}
          placeholder="Tizim"
          options={[
            { value: '', label: 'Barcha tizimlar' },
            { value: 'CLICK', label: 'Click' },
          ]}
        />
      </FilterBar>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={paymentsData?.data ?? []}
          keyOf={(row) => row.id}
          loading={listLoading}
          loadingRows={10}
          empty={
            <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
              Hech qanday to‘lov ma’lumotlari topilmadi
            </div>
          }
        />
      </div>

      {/* Pagination */}
      {paymentsData && paymentsData.total > 0 && (
        <Pagination
          meta={{
            page: paymentsData.page,
            pageSize: paymentsData.limit,
            total: paymentsData.total,
            totalPages: Math.ceil(paymentsData.total / paymentsData.limit),
            hasNext: paymentsData.page * paymentsData.limit < paymentsData.total,
            hasPrevious: paymentsData.page > 1,
          }}
          onPage={(p) => setPage(p)}
          summary={(pg, tot) => `${pg} / ${tot} sahifa`}
          navLabel="Sahifalar bo‘yicha harakat"
          previousLabel="Oldingi"
          nextLabel="Keyingi"
        />
      )}
    </div>
  );
}
