'use client';

/**
 * The global "AI answers support while nobody is at the desk" switch.
 *
 * It used to sit inside the support desk's list header; it lives on the AI
 * page now, with the rest of the assistant's controls. Same two endpoints:
 * `GET /admin/support/ai-status` and `POST /admin/support/ai-toggle`.
 */

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { IOSToggle } from '@/shared/ui/IOSToggle';
import { cn } from '@/shared/lib/cn';

export function AiSupportToggleCard() {
  const t = useTranslations('support');

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    http
      .get<{ enabled: boolean }>(api.support.aiStatus)
      .then((res) => {
        if (!cancelled && typeof res?.enabled === 'boolean') setEnabled(res.enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await http.post<{ enabled: boolean }>(api.support.toggleAi, { enabled: next });
      if (typeof res?.enabled === 'boolean') setEnabled(res.enabled);
      toast.success(next ? t('aiToggledOn') : t('aiToggledOff'));
    } catch {
      setEnabled(previous);
      toast.error(t('errors.status'));
    } finally {
      setBusy(false);
    }
  };

  const on = enabled === true;

  return (
    <div
      className="card p-5 flex items-center gap-4"
      style={{
        background: on ? 'rgba(16,185,129,0.06)' : undefined,
        borderColor: on ? 'var(--color-success-border)' : undefined,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <div
        className="w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
        style={{
          background: on ? 'rgba(16,185,129,0.15)' : 'var(--color-surface-3)',
          color: on ? 'var(--color-success)' : 'var(--color-text-muted)',
        }}
      >
        <Bot size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('aiAssistant')}
          </span>
          <span
            className={cn('status-dot', on && 'animate-pulse-status')}
            style={{ width: 7, height: 7, background: on ? 'var(--color-success)' : 'var(--color-text-muted)' }}
          />
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {enabled === null ? '…' : on ? t('aiEnabledDesc') : t('aiDisabledDesc')}
        </p>
      </div>
      <IOSToggle checked={on} onChange={(next) => void toggle(next)} disabled={busy || enabled === null} />
    </div>
  );
}
