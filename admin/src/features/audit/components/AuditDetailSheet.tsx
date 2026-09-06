'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import type { AuditLogRow } from '@/shared/api/types';
import { Badge } from '@/shared/ui/Badge';
import { severityVariant } from './severity';
import { JsonTree } from './JsonTree';
import { Z_DIALOG } from '@/shared/ui/z-layers';

/**
 * The expanded form of one audit row: everything the table has no width for,
 * plus the `changes` and `meta` payloads as a readable tree.
 *
 * It is a bottom sheet below md and a centred dialog above, rather than an
 * in-table disclosure, because the payload of a single row routinely runs
 * longer than the viewport — pushing thirty other rows down the page to read
 * one of them is the desktop habit this panel is trying not to inherit.
 */

const subscribeNever = () => () => {};

/**
 * What Tab may reach while the sheet is open. Kept local rather than shared
 * with the other dialogs on purpose: a cycle like the one below is only safe
 * because nothing in this sheet portals a popover out to `document.body`. The
 * shared `Select` does exactly that and runs its own focus management, so a
 * trap that forced focus back inside would make it unreachable — which is why
 * generalising this belongs with those dialogs and not here.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface AuditDetailSheetProps {
  row: AuditLogRow | null;
  onClose: () => void;
  /** Translated action name, resolved by the caller against `auditActions`. */
  actionLabel: string;
  /**
   * Translated severity, resolved by the caller with its `t.has` guard.
   *
   * Looked up here instead, a severity the backend adds later — or any casing
   * drift — printed the literal message path `audit.severity.EMERGENCY` in the
   * badge, while the guarded table behind the sheet printed `EMERGENCY`: two
   * different labels for one row, one of them a raw key.
   */
  severityLabel: string;
}

export function AuditDetailSheet({
  row,
  onClose,
  actionLabel,
  severityLabel,
}: AuditDetailSheetProps) {
  const t = useTranslations('audit');
  const c = useTranslations('common');
  const locale = useLocale();

  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  /** The portal root, so the Tab cycle below can see the backdrop button too —
   *  it is a focusable sibling of the dialog, not a descendant of it. */
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (row) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [row, onClose]);

  useEffect(() => {
    if (!row) return;
    // Restore whatever was there rather than clearing, the way the moderation
    // kit's sheet does: opened over a surface that had already locked the
    // page, this would otherwise hand scrolling back while that one is still
    // open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [row]);

  /**
   * Focus in on open, back to the row on close.
   *
   * The sheet declared `aria-modal` and locked the page but never moved focus,
   * so a keyboard reader who opened a row was left standing on the table
   * behind an opaque backdrop, tabbing through a sidebar they could not see,
   * with a screen reader announcing the whole page rather than the dialog.
   *
   * `mounted` is in the dependency list because the portal's children do not
   * exist on the render where `useSyncExternalStore` still answers false — a
   * `[row]`-only effect can run with `panelRef.current` still null and never
   * try again. `preventScroll`, because focusing the panel in the middle of
   * `animate-slide-up-mobile` jumps the page on iOS.
   */
  useEffect(() => {
    if (!row || !mounted) return;
    const trigger = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      // The feed keeps its rows and refetches underneath, so the row that
      // opened this can be detached by the time it closes — and focusing a
      // detached node silently drops focus to <body>, which is the half of
      // this bug that costs the reader their place in a 25-row feed.
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [row, mounted]);

  /** Tab wraps inside the portal instead of walking out into the covered page.
   *  Scoped to the portal root rather than to the `role="dialog"` element, or
   *  the backdrop's own close button would become an unreachable tab stop. */
  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!row || !mounted) return null;

  const stamp = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(row.createdAt));

  // The route the action came in on, when the row recorded one. Three separate
  // nullable columns that only mean anything together.
  const request = [row.method, row.path].filter(Boolean).join(' ');

  /*
   * `Z_DIALOG`, not the literal `z-[999999]` this used to carry.
   *
   * That number was picked to beat the mobile dock (99999) and beat everything
   * else with it. The shared `Select` portals its dropdown to `document.body`
   * at `Z_DIALOG_POPOVER` (100001), so a dropdown opened from inside this
   * sheet was painted UNDERNEATH the sheet and its opaque blurred backdrop:
   * the options were invisible, and a tap where they should have been hit the
   * backdrop and closed the whole form. Toasts sit just above that, so an
   * error raised while this was open was invisible too.
   */
  return createPortal(
    <div
      ref={rootRef}
      onKeyDown={trapTab}
      className="fixed inset-0 flex items-center justify-center md:p-4"
      style={{ zIndex: Z_DIALOG }}
    >
      <button
        type="button"
        aria-label={c('close')}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(5,11,22,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={actionLabel}
        // Focusable as a target for the effect above, never as a tab stop.
        tabIndex={-1}
        className="relative w-full flex flex-col overflow-hidden
                   md:max-w-2xl md:rounded-[24px] md:animate-scale-in
                   max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0
                   max-md:rounded-t-[28px] max-md:animate-slide-up-mobile"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
          maxHeight: 'calc(100dvh - 32px)',
        }}
      >
        <div
          className="md:hidden w-12 h-1 rounded-full mx-auto mt-3 shrink-0"
          style={{ background: 'var(--color-border-medium)' }}
        />

        <div
          className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={severityVariant(row.severity)} label={severityLabel} />
              <h2
                className="text-[15px] font-bold min-w-0 truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {actionLabel}
              </h2>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {stamp}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={c('close')}
            className="icon-btn flex w-11 h-11 md:w-8 md:h-8 -mt-1.5 -mr-1.5 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 flex flex-col gap-5
                        max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
          {row.summary && (
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {row.summary}
            </p>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            <Field label={t('columns.actor')} value={row.actorLabel ?? row.actorType} />
            <Field label={t('filters.actorType')} value={row.actorType} />
            <Field label={t('filters.actorId')} value={row.actorId} mono />
            <Field
              label={t('columns.entity')}
              value={
                row.entityLabel ?? (row.entityType ? row.entityType : null)
              }
            />
            <Field label={t('filters.entityType')} value={row.entityType} />
            <Field label={t('filters.entityId')} value={row.entityId} mono />
            <Field label={t('columns.ip')} value={row.ip} mono />
            <Field
              label="HTTP"
              value={[request, row.statusCode].filter(Boolean).join(' · ') || null}
              mono
            />
            <Field label="request-id" value={row.requestId} mono />
            <Field label="user-agent" value={row.userAgent} className="sm:col-span-2" />
          </dl>

          <section>
            <h3
              className="text-xs font-bold uppercase tracking-[0.09em] mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('changes')}
            </h3>
            {row.changes && Object.keys(row.changes).length > 0 ? (
              <JsonTree value={row.changes} />
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {t('noChanges')}
              </p>
            )}
          </section>

          <section>
            <h3
              className="text-xs font-bold uppercase tracking-[0.09em] mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('meta')}
            </h3>
            {row.meta && Object.keys(row.meta).length > 0 ? (
              <JsonTree value={row.meta} />
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {c('noData')}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One label/value pair; renders nothing at all when the value is absent, so
 *  the grid never shows a column of em-dashes for a row that carried little. */
function Field({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: ReactNode;
  value: string | number | null | undefined;
  mono?: boolean;
  className?: string;
}) {
  if (!label || value === null || value === undefined || value === '') return null;
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </dt>
      <dd
        className={`text-[13px] break-words ${mono ? 'font-mono text-[12px]' : ''}`}
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </dd>
    </div>
  );
}
