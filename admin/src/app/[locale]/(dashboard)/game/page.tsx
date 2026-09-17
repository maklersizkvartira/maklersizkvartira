'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Game2048 } from '@/features/game/Game2048';
import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import {
  Gamepad2,
  Coins,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Search,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';

interface WithdrawalRow {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  cardNumber: string;
  cardHolder: string | null;
  amountUzs: number;
  coinsSpent: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
}

export default function GamePage() {
  const [activeTab, setActiveTab] = useState<'WITHDRAWALS' | 'GAME'>('WITHDRAWALS');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await http.get<WithdrawalRow[]>(api.spinner.withdrawals());
      setWithdrawals(Array.isArray(res) ? res : []);
    } catch (e: any) {
      console.error('Failed to load withdrawals:', e);
      setErrorMsg(e?.message || "To'lov so'rovlarini yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'WITHDRAWALS') {
      fetchWithdrawals();
    }
  }, [activeTab]);

  const handleUpdateStatus = async (
    id: string,
    status: 'APPROVED' | 'REJECTED',
    defaultNote?: string
  ) => {
    let note = defaultNote || '';
    if (status === 'REJECTED') {
      const reason = window.prompt(
        'Rad etish sababini kiriting (foydalanuvchiga ko‘rsatiladi va sarflangan coinlar unga qaytarib beriladi):',
        "Karta ma'lumotlari noto'g'ri kiritilgan"
      );
      if (reason === null) return;
      note = reason;
    } else {
      const confirmed = window.confirm(
        'Haqiqatan ham bu foydalanuvchining kartasiga pul o‘tkazildimi va so‘rovni tasdiqlamoqchimisiz?'
      );
      if (!confirmed) return;
    }

    try {
      setProcessingId(id);
      setErrorMsg(null);
      await http.patch(api.spinner.updateWithdrawal(id), {
        status,
        adminNote: note,
      });

      setSuccessMsg(
        status === 'APPROVED'
          ? "To'lov muvaffaqiyatli tasdiqlandi!"
          : "So'rov rad etildi va foydalanuvchiga coinlar to'liq qaytarildi."
      );
      setTimeout(() => setSuccessMsg(null), 4000);

      // Refresh data
      await fetchWithdrawals();
    } catch (e: any) {
      setErrorMsg(e?.message || "Amalni bajarishda xatolik yuz berdi.");
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered rows
  const filteredRows = withdrawals.filter((row) => {
    if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = row.userName?.toLowerCase().includes(q);
      const matchPhone = row.userPhone?.toLowerCase().includes(q);
      const matchCard = row.cardNumber?.replace(/\s+/g, '').includes(q);
      const matchHolder = row.cardHolder?.toLowerCase().includes(q);
      return matchName || matchPhone || matchCard || matchHolder;
    }
    return true;
  });

  // Calculate stats
  const pendingCount = withdrawals.filter((w) => w.status === 'PENDING').length;
  const pendingSum = withdrawals
    .filter((w) => w.status === 'PENDING')
    .reduce((acc, curr) => acc + (curr.amountUzs || 0), 0);
  const approvedSum = withdrawals
    .filter((w) => w.status === 'APPROVED')
    .reduce((acc, curr) => acc + (curr.amountUzs || 0), 0);
  const totalCoinsSpent = withdrawals.reduce((acc, curr) => acc + (curr.coinsSpent || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Omad Barabani & O'yinlar Markazi"
        subtitle="Foydalanuvchilarning Uyiz Coin to'lov so'rovlarini (Uzcard/Humo) boshqarish va admin ko'ngilochar o'yini."
        eyebrow={
          <div className="flex items-center gap-1.5 text-brand">
            <Coins size={14} />
            <span>Gamifikatsiya & Moliya</span>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-line gap-2">
        <button
          onClick={() => setActiveTab('WITHDRAWALS')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'WITHDRAWALS'
              ? 'border-brand text-brand'
              : 'border-transparent text-muted hover:text-content'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Coin To&apos;lov So&apos;rovlari (Kartaga)</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500 text-white font-black animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('GAME')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'GAME'
              ? 'border-brand text-brand'
              : 'border-transparent text-muted hover:text-content'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>2048: Uyiz Imperiyasi</span>
        </button>
      </div>

      {/* TAB 1: WITHDRAWALS */}
      {activeTab === 'WITHDRAWALS' && (
        <div className="space-y-6">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Stats KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Kutilayotgan So&apos;rovlar</span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-content">{pendingCount} ta</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  ({pendingSum.toLocaleString()} so&apos;m)
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1">To&apos;lov kutilayotgan kartalar</p>
            </div>

            <div className="p-4 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">To&apos;lab Berilgan Jami</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {approvedSum.toLocaleString()} so&apos;m
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1">Muvaffaqiyatli o&apos;tkazildi</p>
            </div>

            <div className="p-4 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Sarflangan Coinlar</span>
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Coins className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-content">
                  {totalCoinsSpent.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-muted mt-1">Pulga almashtirilgan coinlar</p>
            </div>

            <div className="p-4 rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Kurs & Cheklov</span>
                <span className="p-2 rounded-xl bg-brand/10 text-brand">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-black text-content">100 C = 1 000 UZS</span>
              </div>
              <p className="text-[11px] text-muted mt-1">Limit: 1 000 - 10 000 UZS</p>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-line">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'Barchasi' },
                { id: 'PENDING', label: `Kutilmoqda (${pendingCount})` },
                { id: 'APPROVED', label: "To'langan" },
                { id: 'REJECTED', label: 'Rad etilgan' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-brand text-on-brand shadow-sm'
                      : 'bg-surface-2 text-muted hover:text-content'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Foydalanuvchi, karta yoki tel..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-2 border border-line text-xs text-content placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>

              <button
                onClick={fetchWithdrawals}
                className="p-2 rounded-xl bg-surface-2 hover:bg-surface border border-line text-muted hover:text-content transition-colors"
                title="Yangilash"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-muted font-bold">
                  <th className="p-3.5">Foydalanuvchi</th>
                  <th className="p-3.5">Karta Raqami</th>
                  <th className="p-3.5">Karta Egasi</th>
                  <th className="p-3.5">Summa (UZS)</th>
                  <th className="p-3.5">Sana</th>
                  <th className="p-3.5">Holat</th>
                  <th className="p-3.5 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      So&apos;rovlar yuklanmoqda...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      Hech qanday so&apos;rov topilmadi.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isPending = row.status === 'PENDING';
                    const isApproved = row.status === 'APPROVED';
                    const isRejected = row.status === 'REJECTED';

                    return (
                      <tr key={row.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-content">{row.userName}</div>
                          <div className="text-[11px] text-muted font-mono">{row.userPhone}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-content text-[13px]">
                            <span>{row.cardNumber}</span>
                            <button
                              onClick={() => copyToClipboard(row.cardNumber.replace(/\s+/g, ''), row.id)}
                              className="p-1 rounded hover:bg-surface-2 text-muted hover:text-brand transition-colors"
                              title="Nusxalash"
                            >
                              {copiedId === row.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-muted">
                            {row.cardNumber.startsWith('8600') ? 'Uzcard' : row.cardNumber.startsWith('9860') ? 'Humo' : 'Karta'}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <span className="text-content font-medium">
                            {row.cardHolder || <span className="text-muted italic">—</span>}
                          </span>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {row.amountUzs.toLocaleString()} so&apos;m
                          </div>
                          <div className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            <span>{row.coinsSpent} coin</span>
                          </div>
                        </td>

                        <td className="p-3.5 text-muted text-[11px]">
                          <div>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</div>
                          <div>{row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        </td>

                        <td className="p-3.5">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" />
                              <span>Kutilmoqda</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>To&apos;landi</span>
                            </span>
                          )}
                          {isRejected && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-danger/10 text-danger border border-danger/20"
                              title={row.adminNote || 'Rad etilgan'}
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Rad etildi</span>
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateStatus(row.id, 'APPROVED')}
                                disabled={processingId === row.id}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Pul o&apos;tkazildi</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(row.id, 'REJECTED')}
                                disabled={processingId === row.id}
                                className="px-2.5 py-1.5 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger font-bold text-xs transition-all"
                                title="Rad etish va coinni qaytarish"
                              >
                                Rad etish
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted italic">
                              {row.adminNote || 'Bajarildi'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GAME 2048 */}
      {activeTab === 'GAME' && <Game2048 />}
    </div>
  );
}
