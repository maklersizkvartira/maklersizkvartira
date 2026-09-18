'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User as UserIcon,
  Loader2,
} from 'lucide-react';

import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Avatar } from '@/shared/ui/Avatar';
import { toast } from '@/shared/ui/Toast';
import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminUserRow } from '@/shared/api/types';

export interface UserBalanceTarget {
  id: string;
  name: string;
  phone?: string;
  balance?: number;
  avatar?: string | null;
}

interface AdjustBalanceModalProps {
  open: boolean;
  onClose: () => void;
  targetUser?: UserBalanceTarget | null;
  onSuccess?: (newBalance: number, target: UserBalanceTarget) => void;
}

const PRESET_AMOUNTS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000];

const PRESET_REASONS = [
  'Admin orqali hisob to‘ldirildi',
  'Naqd pul / Karta to‘lovi qabul qilindi',
  'Payme / Click to‘lovi xatoligi tuzatildi',
  'Texnik uzilish uchun kompensatsiya',
  'Rag‘batlantiruvchi bonus',
];

export function AdjustBalanceModal({
  open,
  onClose,
  targetUser,
  onSuccess,
}: AdjustBalanceModalProps) {
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<UserBalanceTarget | null>(targetUser ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUserRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [actionType, setActionType] = useState<'add' | 'deduct'>('add');
  const [amountStr, setAmountStr] = useState<string>('50000');
  const [reason, setReason] = useState<string>('Admin orqali hisob to‘ldirildi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync selected user when targetUser prop changes
  useEffect(() => {
    if (targetUser) {
      setSelectedUser(targetUser);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setSelectedUser(null);
    }
  }, [targetUser, open]);

  // Debounced live user search if no target user selected
  useEffect(() => {
    if (!open || selectedUser) return;
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await http.page<AdminUserRow>(
          api.users.list({ search: query, pageSize: 5 })
        );
        setSearchResults(data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, open, selectedUser]);

  const rawAmount = useMemo(() => {
    const cleaned = amountStr.replace(/\D/g, '');
    return parseInt(cleaned, 10) || 0;
  }, [amountStr]);

  const currentBalance = selectedUser?.balance ?? 0;
  const delta = actionType === 'add' ? rawAmount : -rawAmount;
  const newBalance = Math.max(0, currentBalance + delta);

  const formatUzs = (num: number) => num.toLocaleString('uz-UZ') + ' so‘m';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUser) {
      setErrorMsg('Iltimos, avval balansini to‘ldirmoqchi bo‘lgan foydalanuvchini tanlang');
      return;
    }

    if (rawAmount < 1_000) {
      setErrorMsg('Minimal summa 1 000 so‘m bo‘lishi shart');
      return;
    }

    if (rawAmount > 5_000_000) {
      setErrorMsg('Bitta amaliyot uchun maksimal summa 5 000 000 so‘m');
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg('Iltimos, amaliyot sababini kamida 3 ta harf bilan yozing');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await http.post<{
        status: string;
        oldBalance: number;
        newBalance: number;
        adjusted: number;
      }>(api.users.adjustBalance(selectedUser.id), {
        amount: delta,
        reason: reason.trim(),
      });

      const finalBalance = response?.newBalance ?? newBalance;

      toast.success(
        actionType === 'add'
          ? `${selectedUser.name} hisobiga ${formatUzs(rawAmount)} muvaffaqiyatli qo‘shildi!`
          : `${selectedUser.name} hisobidan ${formatUzs(rawAmount)} yechildi!`
      );

      // Invalidate relevant queries across admin panel
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.invalidateQueries({ queryKey: ['users', selectedUser.id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-payment-stats'] });

      onSuccess?.(finalBalance, { ...selectedUser, balance: finalBalance });
      onClose();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'Balansni yangilashda xatolik yuz berdi';
      setErrorMsg(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Foydalanuvchi balansini boshqarish"
      subtitle="Foydalanuvchi hamyoniga to‘g‘ridan-to‘g‘ri pul qo‘shish yoki yechib olish"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* User Selection or Active User Preview */}
        {!selectedUser ? (
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Foydalanuvchini qidirish (Ism yoki Telefon)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="+998901234567 yoki Ismi bo‘yicha..."
                className="pl-9"
                fullWidth
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] animate-spin" />
              )}
            </div>

            {/* Results dropdown */}
            {searchResults.length > 0 && (
              <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] shadow-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-[var(--color-border)]">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser({
                        id: u.id,
                        name: u.name,
                        phone: u.phone,
                        balance: u.balance,
                        avatar: u.avatar,
                      });
                      setSearchResults([]);
                    }}
                    className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={u.avatar} name={u.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--color-text)] truncate">{u.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{u.phone}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatUzs(u.balance || 0)}
                      </span>
                      <p className="text-[10px] text-[var(--color-text-muted)]">joriy balans</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
                Foydalanuvchi topilmadi
              </p>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={selectedUser.avatar} name={selectedUser.name} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--color-text)] truncate">
                    {selectedUser.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold">
                    Tanlandi
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">{selectedUser.phone || 'Telefon yo‘q'}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Joriy balans</span>
              <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                {formatUzs(currentBalance)}
              </span>
              {!targetUser && (
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="block text-[10px] text-blue-600 hover:underline mt-0.5 ml-auto"
                >
                  Boshqasini tanlash
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Type Toggle (Add / Deduct) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Amaliyot turi
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActionType('add')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                actionType === 'add'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Plus className="w-4 h-4" />
              Hisobga qo‘shish (+)
            </button>
            <button
              type="button"
              onClick={() => setActionType('deduct')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                actionType === 'deduct'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Minus className="w-4 h-4" />
              Hisobdan yechish (-)
            </button>
          </div>
        </div>

        {/* Amount Input & Preset Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Summa (so‘m)
            </label>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Min: 1 000 | Max: 5 000 000
            </span>
          </div>
          <div className="relative">
            <Input
              type="text"
              value={rawAmount > 0 ? rawAmount.toLocaleString('uz-UZ') : ''}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="50 000"
              className="text-base font-bold font-mono pl-3 pr-16"
              fullWidth
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-muted)]">
              SO‘M
            </span>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmountStr(String(amt))}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                  rawAmount === amt
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                +{amt.toLocaleString('uz-UZ')}
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Preview Banner */}
        {selectedUser && rawAmount > 0 && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs">
            <div className="flex items-center justify-between font-medium text-blue-950 dark:text-blue-200">
              <span>Hozirgi balans:</span>
              <span className="font-mono">{formatUzs(currentBalance)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-blue-700 dark:text-blue-300 mt-1">
              <span>O‘zgarish ({actionType === 'add' ? '+' : '-'}):</span>
              <span className="font-mono">
                {actionType === 'add' ? '+' : '-'}
                {formatUzs(rawAmount)}
              </span>
            </div>
            <div className="border-t border-blue-200 dark:border-blue-800 my-1.5" />
            <div className="flex items-center justify-between font-black text-sm text-blue-900 dark:text-blue-100">
              <span>Yangi balans:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {formatUzs(newBalance)}
              </span>
            </div>
          </div>
        )}

        {/* Reason / Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Sabab / Audit izohi
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Amaliyot sababi..."
            fullWidth
          />
          <div className="flex flex-wrap gap-1 pt-1">
            {PRESET_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-[10px] px-2 py-0.5 rounded-md border text-left transition-colors ${
                  reason === r
                    ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 border-transparent font-semibold'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !selectedUser || rawAmount <= 0}
            className={actionType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Bajarilmoqda...
              </span>
            ) : actionType === 'add' ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {formatUzs(rawAmount)} qo‘shish
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Minus className="w-4 h-4" />
                {formatUzs(rawAmount)} yechib olish
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
