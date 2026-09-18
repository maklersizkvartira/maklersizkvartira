'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Crown,
  Flame,
  Building2,
  Wallet,
} from 'lucide-react';

import { http } from '@/shared/lib/http';
import { PageHeader } from '@/shared/ui/PageHeader';
import { PageTabs } from '@/shared/ui/PageTabs';
import { Button } from '@/shared/ui/Button';
import { StatusPill } from '@/shared/ui/StatusPill';
import { PremiumStatCard } from '@/features/dashboard/components/PremiumStatCard';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Pagination } from '@/shared/ui/Pagination';
import { AdjustBalanceModal } from '@/features/users/components/AdjustBalanceModal';

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
  listingId: string | null;
  listingTitle: string | null;
  listingPrice: number | null;
  listingDistrict: string | null;
  listingCity: string | null;
  validUntil: string | null;
  isStillActive: boolean;
  createdAt: string;
}

interface PaymentStats {
  totalRevenue: number;
  totalCount: number;
  clickRevenue: number;
  clickCount: number;
  paymeRevenue: number;
  paymeCount: number;
  uzumRevenue: number;
  uzumCount: number;
  verifiedUsersCount: number;
  vipListingsCount: number;
  topListingsCount: number;
  spentTop: number;
  spentVip: number;
  spentVerified: number;
}

export default function PaymentsPage() {
  const locale = useLocale();

  const [activeTab, setActiveTab] = useState<'click' | 'purchases'>('click');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  // Fetch Stats (Real revenue split by provider and services)
  const { data: statsData, isLoading: statsLoading } = useQuery<{ status: string } & PaymentStats>({
    queryKey: ['admin-payment-stats'],
    queryFn: () => http.get('/admin/payments/stats'),
  });

  // Fetch Payments List (Click & Payme real top-ups)
  const { data: paymentsData, isLoading: listLoading } = useQuery<{
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

  // Fetch Purchases List (TOP, VIP, Galochka purchases with listing info)
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
      width: '180px',
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-bold text-sm text-[var(--color-text)]">{row.userName || 'Noma‘lum'}</div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">{row.userPhone}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Summa',
      width: '140px',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-sm whitespace-nowrap" style={{ color: 'var(--color-success)' }}>
          +{formatNumber(row.amount)} {row.currency}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'To‘lov maqsadi',
      width: '150px',
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
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${badgeColor}`}>
            {label}
          </span>
        );
      },
    },
    {
      key: 'cardPan',
      header: 'Karta raqami (boshi & oxiri)',
      width: '170px',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--color-text)] whitespace-nowrap">
          <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
          {row.cardPan || '—'}
        </span>
      ),
    },
    {
      key: 'provider',
      header: 'To‘lov tizimi',
      width: '130px',
      render: (row) => {
        const name = (row.provider || '').toUpperCase();
        let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
        if (name === 'CLICK') {
          badgeStyle = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300';
        } else if (name === 'PAYME') {
          badgeStyle = 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300';
        } else if (name === 'UZUM' || name === 'UZUMBANK') {
          badgeStyle = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
        }
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold whitespace-nowrap ${badgeStyle}`}>
            <CreditCard className="w-3.5 h-3.5" />
            {name}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Holat',
      width: '140px',
      render: (row) => {
        if (row.status === 'SUCCESS') return <StatusPill status="SUCCESS" label="Muvaffaqiyatli" />;
        if (row.status === 'PENDING') return <StatusPill status="PENDING" label="Kutilmoqda" pulse />;
        return <StatusPill status="FAILED" label="Bekor qilingan" />;
      },
    },
    {
      key: 'transId',
      header: 'Tranzaksiya ID',
      width: '180px',
      render: (row) => (
        <div className="text-xs font-mono text-[var(--color-text-muted)] space-y-0.5 whitespace-nowrap">
          {row.clickTransId && <div>Click: {row.clickTransId}</div>}
          {row.paymeTransId && <div>Payme: {row.paymeTransId}</div>}
          {!row.clickTransId && !row.paymeTransId && <div>—</div>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Sana & Soat',
      width: '160px',
      align: 'right',
      render: (row) => (
        <span className="text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
          {dateFormat.format(new Date(row.createdAt))}
        </span>
      ),
    },
  ];

  const purchaseColumns: Column<PurchaseRow>[] = [
    {
      key: 'user',
      header: 'Foydalanuvchi (Xaridor)',
      width: '190px',
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className="font-bold text-sm text-[var(--color-text)]">{row.userName || 'Noma‘lum'}</div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">{row.userPhone}</div>
          <div className="text-[10px] text-[var(--color-text-muted)] font-mono">ID: {row.userId?.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Xizmat turi',
      width: '190px',
      render: (row) => {
        let label = 'Xizmat';
        let badgeColor = 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400';
        let icon = null;
        if (row.type === 'VERIFIED_BADGE' || row.type.includes('VERIFIED')) {
          label = 'Galochka (Tasdiqlangan profil)';
          badgeColor = 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400';
          icon = <ShieldCheck className="w-3 h-3 shrink-0" />;
        } else if (row.type === 'TOP_LISTING' || row.type.includes('TOP')) {
          label = 'TOP E’lon (7 kun)';
          badgeColor = 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
          icon = <Flame className="w-3 h-3 shrink-0" />;
        } else if (row.type === 'VIP_LISTING' || row.type.includes('VIP')) {
          label = 'VIP E’lon (15 kun)';
          badgeColor = 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400';
          icon = <Crown className="w-3 h-3 shrink-0" />;
        }
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${badgeColor}`}>
            {icon}
            {label}
          </span>
        );
      },
    },
    {
      key: 'listing',
      header: 'Qaysi e‘longa sotib olingan?',
      width: '280px',
      render: (row) => {
        if (!row.listingId && !row.listingTitle) {
          return (
            <div className="text-xs text-[var(--color-text-muted)] italic whitespace-nowrap">
              {row.description || 'Profil tasdiqlash uchun (Galochka)'}
            </div>
          );
        }
        return (
          <div className="space-y-1 min-w-[240px]">
            <div className="font-semibold text-xs text-[var(--color-text)] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="line-clamp-1 max-w-[220px]" title={row.listingTitle || ''}>
                {row.listingTitle || 'E‘lon'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
              {(row.listingDistrict || row.listingCity) && (
                <span className="whitespace-nowrap">📍 {[row.listingDistrict, row.listingCity].filter(Boolean).join(', ')}</span>
              )}
              {row.listingPrice != null && (
                <span className="font-mono font-medium whitespace-nowrap" style={{ color: 'var(--color-success)' }}>
                  {formatNumber(row.listingPrice)} so‘m
                </span>
              )}
            </div>
            {row.validUntil && (
              <div className="text-[10px] font-mono whitespace-nowrap">
                {row.isStillActive ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold" style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
                    <CheckCircle2 className="w-3 h-3" /> Faol ({dateFormat.format(new Date(row.validUntil))} gacha)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--color-text-muted)] bg-[var(--color-surface-2)]">
                    <Clock className="w-3 h-3" /> Muddati tugagan ({dateFormat.format(new Date(row.validUntil))})
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Yechilgan summa',
      width: '140px',
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-sm whitespace-nowrap" style={{ color: 'var(--color-danger)' }}>
          -{formatNumber(row.amount)} so‘m
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Balans holati',
      width: '140px',
      align: 'right',
      render: (row) => (
        <div className="text-right whitespace-nowrap">
          <span className="font-mono font-bold text-xs" style={{ color: 'var(--color-success)' }}>
            {formatNumber(row.balanceAfter)} so‘m
          </span>
          <div className="text-[10px] text-[var(--color-text-muted)]">qolgan balans</div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Xarid vaqti',
      width: '160px',
      align: 'right',
      render: (row) => (
        <span className="text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
          {dateFormat.format(new Date(row.createdAt))}
        </span>
      ),
    },
  ];

  const sum = (n?: number) => `${formatNumber(n ?? 0)} so‘m`;
  const cnt = (n?: number) => `${formatNumber(n ?? 0)} ta`;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-fade-in">
      <PageHeader
        icon={<CreditCard size={18} />}
        title="To‘lovlar & Daromad"
        subtitle="Click, Payme va Uzum Bank tushumlari, pullik xizmatlar xaridi va balans auditi"
        actions={
          <Button variant="primary" onClick={() => setIsBalanceModalOpen(true)} className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Balans to‘ldirish
          </Button>
        }
      />

      {/* Row 1: real money in, by provider */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Kassaga real tushumlar
          </h2>
          <span className="text-[11px] text-[var(--color-text-muted)]">Faqat muvaffaqiyatli to‘langan pullar</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <PremiumStatCard
            variant="hero"
            label="Jami real tushum"
            value={sum(statsData?.totalRevenue)}
            sublabel={<>Jami tranzaksiyalar: <b>{statsData?.totalCount ?? 0} ta</b></>}
            icon={<DollarSign size={18} />}
            loading={statsLoading}
          />
          <PremiumStatCard
            label="Click orqali"
            value={sum(statsData?.clickRevenue)}
            sublabel={<span className="text-[var(--color-text-muted)]">Muvaffaqiyatli: {statsData?.clickCount ?? 0} ta to‘lov</span>}
            icon={<span className="text-[11px] font-black">CL</span>}
            loading={statsLoading}
          />
          <PremiumStatCard
            label="Payme orqali"
            value={sum(statsData?.paymeRevenue)}
            sublabel={
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--color-success)' }}>
                <span className="inline-flex h-2 w-2 rounded-full animate-pulse" style={{ background: 'var(--color-success)' }} />
                Faol ulangan {statsData?.paymeCount ? `· ${statsData.paymeCount} ta to‘lov` : '· to‘lovga tayyor'}
              </span>
            }
            icon={<span className="text-[11px] font-black">PM</span>}
            loading={statsLoading}
          />
          <PremiumStatCard
            label="Uzum Bank orqali"
            value={sum(statsData?.uzumRevenue)}
            sublabel={<span className="text-[var(--color-text-muted)]">Muvaffaqiyatli: {statsData?.uzumCount ?? 0} ta to‘lov</span>}
            icon={<span className="text-[11px] font-black">UB</span>}
            loading={statsLoading}
          />
        </div>
      </section>

      {/* Row 2: paid services bought from balances */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Pullik xizmatlar xaridi
          </h2>
          <span className="text-[11px] text-[var(--color-text-muted)]">Foydalanuvchilar balansidan sotib olingan xizmatlar</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PremiumStatCard
            label="TOP e’lonlar"
            value={cnt(statsData?.topListingsCount)}
            sublabel={<span className="text-[var(--color-text-muted)]">Sarflangan: <b className="text-[var(--color-text-primary)]">{sum(statsData?.spentTop)}</b> · 7 000 so‘m/ta</span>}
            icon={<Flame size={16} />}
            loading={statsLoading}
          />
          <PremiumStatCard
            label="VIP e’lonlar"
            value={cnt(statsData?.vipListingsCount)}
            sublabel={<span className="text-[var(--color-text-muted)]">Sarflangan: <b className="text-[var(--color-text-primary)]">{sum(statsData?.spentVip)}</b> · 12 000 so‘m/ta</span>}
            icon={<Crown size={16} />}
            loading={statsLoading}
          />
          <PremiumStatCard
            label="Galochka (tasdiqlangan)"
            value={cnt(statsData?.verifiedUsersCount)}
            sublabel={<span className="text-[var(--color-text-muted)]">Sarflangan: <b className="text-[var(--color-text-primary)]">{sum(statsData?.spentVerified)}</b> · 20 000 so‘m/ta</span>}
            icon={<ShieldCheck size={16} />}
            loading={statsLoading}
          />
        </div>
      </section>

      <PageTabs
        aria-label="To‘lovlar bo‘limlari"
        value={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setPage(1);
        }}
        tabs={[
          { key: 'click', label: 'Tushumlar (Click, Payme, Uzum)', icon: <CreditCard size={13} /> },
          { key: 'purchases', label: 'Xarid qilingan xizmatlar', icon: <Crown size={13} /> },
        ]}
      />

      {/* Tab 1: Payments */}
      {activeTab === 'click' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--color-text-muted)]">To‘lov tizimi:</span>
            <PageTabs
              aria-label="To‘lov tizimi"
              value={providerFilter}
              onChange={(key) => {
                setProviderFilter(key);
                setPage(1);
              }}
              tabs={[
                { key: '', label: 'Barchasi' },
                { key: 'CLICK', label: 'Click' },
                { key: 'PAYME', label: 'Payme' },
                { key: 'UZUM', label: 'Uzum Bank' },
              ]}
            />
          </div>

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
                { value: 'UZUM', label: 'Uzum Bank' },
              ]}
            />
          </FilterBar>

          <div className="card overflow-x-auto p-0">
            <DataTable
              columns={columns}
              rows={paymentRows}
              keyOf={(row) => row.id}
              loading={listLoading}
              loadingRows={10}
              minWidth="1100px"
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

          <div className="card overflow-x-auto p-0">
            <DataTable
              columns={purchaseColumns}
              rows={purchaseRows}
              keyOf={(row) => row.id}
              loading={purchasesLoading}
              loadingRows={10}
              minWidth="1200px"
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

      <AdjustBalanceModal
        open={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
      />
    </div>
  );
}
