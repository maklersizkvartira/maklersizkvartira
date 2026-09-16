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
  cardPan?: string | null;
  clickTransId: string | null;
  clickPaydocId: string | null;
  paymeTransId?: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface PurchaseRow {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
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

  const [activeTab, setActiveTab] = useState<'click' | 'purchases'>('click');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  // Fetch Stats
  const { data: statsData, isLoading: statsLoading } = useQuery<{ status: string } & PaymentStats>({
    queryKey: ['admin-payment-stats'],
    queryFn: () => http.get('/admin/payments/stats'),
  });

  // Fetch Payments List (Click & Payme top-ups)
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
      return http.raw.get(`/admin/payments?${params.toString()}`);
    },
    enabled: activeTab === 'click',
  });

  // Fetch Purchases List (TOP, VIP, Galochka purchases)
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery<{
    status: string;
    data: PurchaseRow[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['admin-purchases', page, serviceTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (serviceTypeFilter) params.set('service_type', serviceTypeFilter);
      return http.raw.get(`/admin/payments/purchases?${params.toString()}`);
    },
    enabled: activeTab === 'purchases',
  });

  // Safely extract rows whether envelope is unwrapped or intact
  const paymentRows = useMemo<PaymentRow[]>(() => {
    if (!paymentsData) return [];
    if (Array.isArray(paymentsData.data)) return paymentsData.data;
    if (Array.isArray(paymentsData)) return paymentsData as unknown as PaymentRow[];
    return [];
  }, [paymentsData]);

  const totalPayments = typeof paymentsData?.total === 'number'
    ? paymentsData.total
    : paymentRows.length;

  const purchaseRows = useMemo<PurchaseRow[]>(() => {
    if (!purchasesData) return [];
    if (Array.isArray(purchasesData.data)) return purchasesData.data;
    if (Array.isArray(purchasesData)) return purchasesData as unknown as PurchaseRow[];
    return [];
  }, [purchasesData]);

  const totalPurchases = typeof purchasesData?.total === 'number'
    ? purchasesData.total
    : purchaseRows.length;

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
      key: 'cardPan',
      header: 'Karta raqami (boshi & oxiri)',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--color-text)]">
          <CreditCard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          {row.cardPan || '—'}
        </span>
      ),
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
      key: 'transId',
      header: 'Tranzaksiya ID',
      render: (row) => (
        <div className="text-xs font-mono text-[var(--color-text-muted)] space-y-0.5">
          {row.clickTransId && <div>Click: {row.clickTransId}</div>}
          {row.paymeTransId && <div>Payme: {row.paymeTransId}</div>}
          {!row.clickTransId && !row.paymeTransId && <div>—</div>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Sana & Soat',
      align: 'right',
      render: (row) => (
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {dateFormat.format(new Date(row.createdAt))}
        </span>
      ),
    },
  ];

  const purchaseColumns: Column<PurchaseRow>[] = [
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
      key: 'service',
      header: 'Xizmat turi',
      render: (row) => {
        let label = 'Xizmat';
        let badgeColor = 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400';
        if (row.type === 'VERIFIED_BADGE') {
          label = 'Galochka (Verified)';
          badgeColor = 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400';
        } else if (row.type === 'TOP_LISTING') {
          label = 'TOP E’lon';
          badgeColor = 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
        } else if (row.type === 'VIP_LISTING') {
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
      key: 'description',
      header: 'Tavsif / E’lon',
      render: (row) => (
        <span className="text-xs font-medium text-[var(--color-text)]">
          {row.description}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Yechilgan summa',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-sm text-rose-600 dark:text-rose-400">
          -{formatNumber(row.amount)} so‘m
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Qolgan balans',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
          {formatNumber(row.balanceAfter)} so‘m
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Sana & Soat',
      align: 'right',
      render: (row) => (
        <span className="text-xs font-mono text-[var(--color-text-muted)]">
          {dateFormat.format(new Date(row.createdAt))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="To‘lovlar & Daromad boshqaruvi"
        subtitle="Click va Payme to‘lovlari, tushumlar, pullik xizmatlar va balans auditi"
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Jami Tushum (Click & Payme)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {statsLoading ? '...' : `${formatNumber(statsData?.totalRevenue ?? 0)} so‘m`}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Muvaffaqiyatli to‘lovlar</p>
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

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] w-fit shadow-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab('click');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'click'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Barcha Tushumlar (Click & Payme)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('purchases');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'purchases'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-400" />
          Xarid qilingan xizmatlar (TOP / VIP / Galochka)
        </button>
      </div>

      {/* Tab 1: Payments */}
      {activeTab === 'click' && (
        <>
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
                { value: 'PAYME', label: 'Payme' },
              ]}
            />
          </FilterBar>

          <div className="card overflow-hidden">
            <DataTable
              columns={columns}
              rows={paymentRows}
              keyOf={(row) => row.id}
              loading={listLoading}
              loadingRows={10}
              empty={
                <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
                  Hech qanday to‘lovlar topilmadi
                </div>
              }
            />
          </div>

          {totalPayments > 0 && (
            <Pagination
              meta={{
                page: paymentsData?.page ?? page,
                pageSize: paymentsData?.limit ?? 20,
                total: totalPayments,
                totalPages: Math.ceil(totalPayments / (paymentsData?.limit ?? 20)),
                hasNext: page * (paymentsData?.limit ?? 20) < totalPayments,
                hasPrevious: page > 1,
              }}
              onPage={(p) => setPage(p)}
              summary={(pg, tot) => `${pg} / ${tot} sahifa`}
              navLabel="Sahifalar bo‘yicha harakat"
              previousLabel="Oldingi"
              nextLabel="Keyingi"
            />
          )}
        </>
      )}

      {/* Tab 2: Service Purchases (TOP / VIP / Verified) */}
      {activeTab === 'purchases' && (
        <>
          <FilterBar
            label="Xizmat filtrlari"
            resetLabel="Tozalash"
            activeCount={serviceTypeFilter ? 1 : 0}
            onReset={() => setServiceTypeFilter('')}
          >
            <Select
              value={serviceTypeFilter}
              onChange={(val) => {
                setServiceTypeFilter(val);
                setPage(1);
              }}
              placeholder="Xizmat turi"
              options={[
                { value: '', label: 'Barcha xizmatlar' },
                { value: 'TOP_LISTING', label: 'TOP E’lon' },
                { value: 'VIP_LISTING', label: 'VIP E’lon' },
                { value: 'VERIFIED_BADGE', label: 'Galochka (Verified)' },
              ]}
            />
          </FilterBar>

          <div className="card overflow-hidden">
            <DataTable
              columns={purchaseColumns}
              rows={purchaseRows}
              keyOf={(row) => row.id}
              loading={purchasesLoading}
              loadingRows={10}
              empty={
                <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
                  Hali hech qanday pullik xizmatlar xaridi amalga oshirilmagan
                </div>
              }
            />
          </div>

          {totalPurchases > 0 && (
            <Pagination
              meta={{
                page: purchasesData?.page ?? page,
                pageSize: purchasesData?.limit ?? 20,
                total: totalPurchases,
                totalPages: Math.ceil(totalPurchases / (purchasesData?.limit ?? 20)),
                hasNext: page * (purchasesData?.limit ?? 20) < totalPurchases,
                hasPrevious: page > 1,
              }}
              onPage={(p) => setPage(p)}
              summary={(pg, tot) => `${pg} / ${tot} sahifa`}
              navLabel="Sahifalar bo‘yicha harakat"
              previousLabel="Oldingi"
              nextLabel="Keyingi"
            />
          )}
        </>
      )}
    </div>
  );
}
