'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

import type { AdminReportRow, ReportStatus, ResolveReportPayload } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Select } from '@/shared/ui/Select';
import { Textarea } from '@/shared/ui/Input';
import {
  KeyValue,
  RiskPill,
  Sheet,
  SheetSection,
  TOUCH_SELECT,
} from '@/features/listings/components/moderation-kit';

import {
  REPORT_LISTING_ACTIONS,
  REPORT_NOTE_MAX,
  REPORT_STATUSES,
  type ReportListingAction,
} from '../constants';

/**
 * One report and the single call that closes it.
 *
 * `PATCH /admin/reports/{id}` resolves the report and acts on the listing in
 * one transaction, so the two decisions are one form here rather than two trips
 * through two screens.
 *
 * Mount with `key={row.id}` — the form is seeded from the row.
 */

interface ResolveReportSheetProps {
  row: AdminReportRow;
  onClose: () => void;
  onSubmit: (body: ResolveReportPayload) => void;
  pending: boolean;
  /** Guarded translators — an enum the catalogues miss prints its wire value.
   *  Passed down rather than looked up again here, so the sheet and the table
   *  behind it can never disagree about what a value is called. */
  statusLabel: (status: string) => string;
  listingActionLabel: (action: string) => string;
  reasonLabel: (reason: string) => string;
  priorityLabel: (priority: string) => string;
}

export function ResolveReportSheet({
  row,
  onClose,
  onSubmit,
  pending,
  statusLabel,
  listingActionLabel,
  reasonLabel,
  priorityLabel,
}: ResolveReportSheetProps) {
  const t = useTranslations('reports');
  const c = useTranslations('common');
  // Borrowed rather than duplicated: these three strings are about the listing
  // this report points at, and `listings` already has all of them.
  const l = useTranslations('listings');
  const locale = useLocale();

  const [status, setStatus] = useState<string>(
    // A report already settled reopens on its own status; an open one defaults
    // to the outcome the moderator is here to record.
    row.status === 'OPEN' || row.status === 'UNDER_REVIEW' ? 'RESOLVED' : row.status,
  );
  const [note, setNote] = useState(row.resolutionNote ?? '');
  const [listingAction, setListingAction] = useState<ReportListingAction>('NONE');

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const showDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : c('never'));

  const submit = () => {
    const trimmed = note.trim();
    onSubmit({
      status: status as ReportStatus,
      // The backend writes `resolution_note` unconditionally, so an empty box
      // clears a note that was there before.
      note: trimmed.length > 0 ? trimmed.slice(0, REPORT_NOTE_MAX) : undefined,
      listingAction,
    });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      closeLabel={c('close')}
      size="lg"
      title={t('resolveTitle')}
      subtitle={row.listingTitle ?? c('unknown')}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            {c('cancel')}
          </Button>
          <Button loading={pending} onClick={submit}>
            {t('resolve')}
          </Button>
        </>
      }
    >
      {/* ── What was reported ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <StatusPill
          status={row.status}
          label={statusLabel(row.status)}
          pulse={row.status === 'OPEN' || row.status === 'UNDER_REVIEW'}
        />
        <Badge variant="neutral" label={priorityLabel(row.priority)} />
        <Badge variant="neutral" label={reasonLabel(row.reason)} />
        <RiskPill score={row.aiRiskScore} label={l('moderation.riskScore')} />
      </div>

      <SheetSection title={c('details')}>
        <KeyValue label={t('columns.listing')} value={row.listingTitle ?? c('unknown')} />
        <KeyValue label={t('columns.reporter')} value={row.reporterLabel ?? c('unknown')} />
        <KeyValue label={t('columns.created')} value={showDate(row.createdAt)} />
        {row.resolvedAt && <KeyValue label={t('resolve')} value={showDate(row.resolvedAt)} />}
        {row.description && (
          <p
            className="text-sm mt-3 pt-3"
            style={{
              color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              borderTop: '1px solid var(--color-border)',
              lineHeight: 1.6,
            }}
          >
            {row.description}
          </p>
        )}
      </SheetSection>

      {/* ── The decision ─────────────────────────────────────────────────── */}
      <SheetSection title={t('columns.status')}>
        <Select
          className={TOUCH_SELECT}
          value={status}
          onChange={setStatus}
          options={REPORT_STATUSES.map((value) => ({ value, label: statusLabel(value) }))}
        />
      </SheetSection>

      <SheetSection title={t('note')}>
        <Textarea
          value={note}
          maxLength={REPORT_NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('notePlaceholder')}
          aria-label={t('note')}
        />
      </SheetSection>

      {/* ── What happens to the listing ──────────────────────────────────── */}
      <SheetSection title={t('columns.listing')}>
        <Select
          className={TOUCH_SELECT}
          value={listingAction}
          onChange={(value) => setListingAction(value as ReportListingAction)}
          options={REPORT_LISTING_ACTIONS.map((value) => ({
            value,
            label: listingActionLabel(value),
          }))}
        />

        {/* Both notes below describe real asymmetries in this route, not UI
            preferences: DELETE here destroys a listing from a MODERATOR-level
            call that `DELETE /admin/listings/{id}` would refuse, and APPROVE
            here leaves `published_at` alone, unlike the approve on the listings
            screen — so the listing is approved but not on the site. */}
        {listingAction === 'DELETE' && (
          <p
            className="flex items-start gap-2 text-xs mt-2.5 p-3 rounded-[var(--radius-md)]"
            style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <AlertTriangle
              size={13}
              className="shrink-0 mt-0.5"
              style={{ color: 'var(--color-danger)' }}
              aria-hidden="true"
            />
            {l('moderation.deleteWarning')}
          </p>
        )}

        {listingAction === 'APPROVE' && (
          <p className="text-xs mt-2.5" style={{ color: 'var(--color-text-muted)' }}>
            {l('actions.viewOnSite')}: {c('no')}
          </p>
        )}
      </SheetSection>
    </Sheet>
  );
}
