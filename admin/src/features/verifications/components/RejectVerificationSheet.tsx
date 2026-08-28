'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, ScanFace } from 'lucide-react';

import type { AdminVerificationRow } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Textarea } from '@/shared/ui/Input';
import {
  KeyValue,
  Sheet,
  SheetSection,
  TOUCH_BUTTONS,
} from '@/features/listings/components/moderation-kit';

import { REJECTION_REASON_MAX } from '../constants';

/**
 * The rejection form.
 *
 * Rejecting is the only branch of `PATCH /admin/verifications/{id}` that takes
 * a reason, and it is the only one that needs a form — approving is a single
 * confirmed call from the row. The reason is required here rather than
 * optional: the user is told why their passport photo came back, and "no
 * reason given" is not an answer they can act on.
 *
 * Mount with `key={row.id}`.
 */

interface RejectVerificationSheetProps {
  row: AdminVerificationRow;
  onClose: () => void;
  onSubmit: (rejectionReason: string) => void;
  onViewDocument: () => void;
  onViewSelfie: () => void;
  pending: boolean;
  /** Guarded translators, passed down so the sheet and the table cannot
   *  disagree about what a value is called. */
  statusLabel: (status: string) => string;
  documentTypeLabel: (type: string) => string;
}

export function RejectVerificationSheet({
  row,
  onClose,
  onSubmit,
  onViewDocument,
  onViewSelfie,
  pending,
  statusLabel,
  documentTypeLabel,
}: RejectVerificationSheetProps) {
  const t = useTranslations('verifications');
  const c = useTranslations('common');
  const u = useTranslations('users');
  const locale = useLocale();

  const [reason, setReason] = useState(row.rejectionReason ?? '');

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const trimmed = reason.trim();

  return (
    <Sheet
      open
      onClose={onClose}
      closeLabel={c('close')}
      size="md"
      title={t('reject')}
      subtitle={row.userName ?? c('unknown')}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            {c('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            // The backend accepts an empty reason; this screen does not.
            disabled={trimmed.length === 0}
            onClick={() => onSubmit(trimmed.slice(0, REJECTION_REASON_MAX))}
          >
            {t('reject')}
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <StatusPill status={row.status} label={statusLabel(row.status)} pulse={row.status === 'PENDING'} />
      </div>

      <SheetSection title={c('details')}>
        <KeyValue label={u('columns.phone')} value={row.userPhone ?? c('unknown')} />
        <KeyValue label={t('columns.type')} value={documentTypeLabel(row.documentType)} />
        <KeyValue label={t('columns.submitted')} value={dateFormat.format(new Date(row.createdAt))} />
      </SheetSection>

      {/* The images are still behind a tap even here: each one can be an ~8 MB
          base64 data URI, and the sheet must open instantly. */}
      <SheetSection title={t('columns.document')}>
        <div className={`flex flex-col sm:flex-row gap-2.5 ${TOUCH_BUTTONS}`}>
          <Button
            variant="secondary"
            icon={<FileText size={14} />}
            disabled={!row.documentUrl}
            onClick={onViewDocument}
          >
            {t('viewDocument')}
          </Button>
          <Button
            variant="secondary"
            icon={<ScanFace size={14} />}
            disabled={!row.selfieUrl}
            onClick={onViewSelfie}
          >
            {t('viewSelfie')}
          </Button>
        </div>
      </SheetSection>

      <SheetSection title={t('rejectionReason')}>
        <Textarea
          value={reason}
          maxLength={REJECTION_REASON_MAX}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('rejectionReasonPlaceholder')}
          aria-label={t('rejectionReason')}
          hint={`${trimmed.length} / ${REJECTION_REASON_MAX}`}
        />
      </SheetSection>
    </Sheet>
  );
}
