'use client';

import { useState, useEffect } from 'react';
import { Users, UserX, Smartphone, Monitor, Clock, Send, Search, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { GuestSubscriberItem } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';

interface GuestSubscribersTableProps {
  onSendToGuest: (guestId: string) => void;
  refreshTrigger?: number;
}

export function GuestSubscribersTable({ onSendToGuest, refreshTrigger = 0 }: GuestSubscribersTableProps) {
  const t = useTranslations('pushPage');

  const [guests, setGuests] = useState<GuestSubscriberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const res = await http.get<GuestSubscriberItem[]>(api.push.guests);
      setGuests(Array.isArray(res) ? res : []);
    } catch {
      setGuests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [refreshTrigger]);

  const parseDevice = (ua: string | null) => {
    if (!ua) return { name: 'Nomaʼlum qurilma', isMobile: false };
    const lower = ua.toLowerCase();
    const isMobile = lower.includes('mobile') || lower.includes('android') || lower.includes('iphone');

    let browser = 'Brauzer';
    if (lower.includes('chrome')) browser = 'Chrome';
    else if (lower.includes('safari')) browser = 'Safari';
    else if (lower.includes('firefox')) browser = 'Firefox';
    else if (lower.includes('edge')) browser = 'Edge';

    let os = 'OS';
    if (lower.includes('android')) os = 'Android';
    else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) os = 'iOS';
    else if (lower.includes('mac')) os = 'macOS';
    else if (lower.includes('win')) os = 'Windows';
    else if (lower.includes('linux')) os = 'Linux';

    return {
      name: `${browser} • ${os}`,
      isMobile,
    };
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
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

  const filtered = guests.filter((g) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return g.guest_id.toLowerCase().includes(q) || (g.user_agent && g.user_agent.toLowerCase().includes(q));
  });

  return (
    <div className="card p-5 md:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Mehmon foydalanuvchilar (Tomosha qilib ketganlar)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saytga kirib roʻyxatdan oʻtmasdan xabarnomalarga ruxsat bergan mehmonlar
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mehmon ID yoki brauzer..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {loading && guests.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          <span className="text-xs">Mehmonlar yuklanmoqda...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <Users className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-sm font-medium">Hozircha hech qanday mehmon obunachi yoʻq</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Mehmonlar saytga kirib push xabarlarga rozilik berganda ularning qurilmalari bu yerda paydo boʻladi.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3 font-semibold">Mehmon ID</th>
                <th className="py-3 px-3 font-semibold">Qurilma va Brauzer</th>
                <th className="py-3 px-3 font-semibold">Qoʻshilgan sana</th>
                <th className="py-3 px-3 font-semibold">Soʻnggi faollik</th>
                <th className="py-3 px-3 font-semibold">Qurilmalar</th>
                <th className="py-3 px-3 font-semibold text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((g) => {
                const device = parseDevice(g.user_agent);
                return (
                  <tr
                    key={g.guest_id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    {/* Guest ID */}
                    <td className="py-3 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {g.guest_id}
                    </td>

                    {/* Device & Browser */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                        {device.isMobile ? (
                          <Smartphone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        ) : (
                          <Monitor className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="font-medium">{device.name}</span>
                      </div>
                    </td>

                    {/* Created date */}
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        {formatDate(g.created_at)}
                      </div>
                    </td>

                    {/* Last active */}
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                      {formatDate(g.last_active)}
                    </td>

                    {/* Devices count */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {g.devices_count} ta qurilma
                      </span>
                    </td>

                    {/* Send push button */}
                    <td className="py-3 px-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSendToGuest(g.guest_id)}
                        className="rounded-lg text-xs gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Xabar yuborish
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
