'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import {
  CreditCard,
  DollarSign,
  ShieldCheck,
  Crown,
  Flame,
  Wallet,
} from 'lucide-react';

import { http } from '@/shared/lib/http';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Badge } from '@/shared/ui/Badge';
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

  const serviceLabel = (type?: string | null) => {
    if (type === 'VERIFIED_BADGE') return { label: 'Galochka', variant: 'purple' as const };
    if (type === 'TOP_LISTING') return { label: 'TOP e’lon', variant: 'warning' as const };
    if (type === 'VIP_LISTING') return { label: 'VIP e’lon', variant: 'info' as const };
    return { label: 'Hisob to‘ldirish', variant: 'neutral' as const };
  };

  const providerName = (provider?: string | null) => {
    const name = (provider || '').toUpperCase();
    if (name === 'UZUM' || name === 'UZUMBANK') return 'Uzum Bank';
    if (name === 'CLICK') return 'Click';
    if (name === 'PAYME') return 'Payme';
    return name || '—';
  };

  const columns: Column<PaymentRow>[] = [
    {
      key: 'user',
      header: 'Foydalanuvchi',
      width: '190px',
      render: (row) => (
        <div className="whitespace-nowrap min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {row.userName || 'Noma‘lum'}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.userPhone}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Summa',
      width: '140px',
      align: 'right',
      render: (row) => (
        <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--color-success)' }}>
          +{formatNumber(row.amount)} {row.currency}
        </span>
      ),
    },
    {
      key: 'service',
      header: 'Maqsad',
      width: '130px',
      render: (row) => {
        const { label, variant } = serviceLabel(row.serviceType);
        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'provider',
      header: 'Tizim',
      width: '110px',
      render: (row) => (
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
          {providerName(row.provider)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      width: '130px',
      render: (row) => {
        if (row.status === 'SUCCESS') return <StatusPill status="SUCCESS" label="Muvaffaqiyatli" />;
        if (row.status === 'PENDING') return <StatusPill status="PENDING" label="Kutilmoqda" />;
        return <StatusPill status="FAILED" label="Bekor qilingan" />;
      },
    },
    {
      key: 'date',
      header: 'Sana',
      width: '170px',
      align: 'right',
      render: (row) => {
        const ref = row.clickTransId || row.paymeTransId;
        return (
          <div className="whitespace-nowrap text-right">
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {dateFormat.format(new Date(row.createdAt))}
            </div>
            {ref && (
              <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }} title={ref}>
                ID {ref}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const purchaseColumns: Column<PurchaseRow>[] = [
    {
      key: 'user',
      header: 'Xaridor',
      width: '180px',
      render: (row) => (
        <div className="whitespace-nowrap min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {row.userName || 'Noma‘lum'}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.userPhone}</div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Xizmat',
      width: '150px',
      render: (row) => {
        const type = row.type || '';
        if (type.includes('VERIFIED')) return <Badge variant="purple" label="Galochka" />;
        if (type.includes('TOP')) return <Badge variant="warning" label="TOP e’lon" />;
        if (type.includes('VIP')) return <Badge variant="info" label="VIP e’lon" />;
        return <Badge variant="neutral" label="Xizmat" />;
      },
    },
    {
      key: 'listing',
      header: 'E‘lon',
      width: '260px',
      render: (row) => {
        if (!row.listingId && !row.listingTitle) {
          return (
            <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
              {row.description || 'Profil tasdiqlash (Galochka)'}
            </span>
          );
        }
        const place = [row.listingDistrict, row.listingCity].filter(Boolean).join(', ');
        const term = row.validUntil
          ? `${row.isStillActive ? 'faol' : 'muddati tugagan'} (${dateFormat.format(new Date(row.validUntil))})`
          : '';
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium truncate max-w-[240px]" style={{ color: 'var(--color-text-primary)' }} title={row.listingTitle || ''}>
              {row.listingTitle || 'E‘lon'}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
              {[place, term].filter(Boolean).join(' · ')}
            </div>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Summa',
      width: '150px',
      align: 'right',
      render: (row) => (
        <div className="whitespace-nowrap text-right">
          <div className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
            -{formatNumber(row.amount)} so‘m
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            qoldi: {formatNumber(row.balanceAfter)} so‘m
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Sana',
      width: '150px',
      align: 'right',
      render: (row) => (
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
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

      {/* One filter card: which list, then that list's own filters. */}
      <FilterBar
        label="Filtrlar"
        resetLabel="Tozalash"
        activeCount={
          activeTab === 'click'
            ? (statusFilter ? 1 : 0) + (providerFilter ? 1 : 0)
            : serviceTypeFilter
              ? 1
              : 0
        }
        onReset={() => {
          setStatusFilter('');
          setProviderFilter('');
          setServiceTypeFilter('');
          setPage(1);
        }}
        leading={
          <Select
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val as 'click' | 'purchases');
              setPage(1);
            }}
            options={[
              { value: 'click', label: 'Tushumlar (Click, Payme, Uzum)' },
              { value: 'purchases', label: 'Xarid qilingan xizmatlar' },
            ]}
          />
        }
      >
        {activeTab === 'click' ? (
          <>
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
          </>
        ) : (
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
        )}
      </FilterBar>

      {/* Tab 1: Payments */}
      {activeTab === 'click' && (
        <>
          <div>
            <DataTable
              columns={columns}
              rows={paymentRows}
              keyOf={(row) => row.id}
              loading={listLoading}
              loadingRows={10}
              minWidth="0"
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
          <div>
            <DataTable
              columns={purchaseColumns}
              rows={purchaseRows}
              keyOf={(row) => row.id}
              loading={purchasesLoading}
              loadingRows={10}
              minWidth="0"
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
