'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';

import type { AdminTopRequestRow } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Input, Textarea } from '@/shared/ui/Input';
import { useConfirm } from '@/providers/confirm-provider';
import {
  FEATURE_DAYS_DEFAULT,
  FEATURE_DAYS_MAX,
  FEATURE_DAYS_MIN,
  FEATURE_WEIGHT_DEFAULT,
  FEATURE_WEIGHT_MAX,
  FEATURE_WEIGHT_MIN,
} from '@/features/listings/constants';
import {
  KeyValue,
  Sheet,
  SheetSection,
  Thumb,
} from '@/features/listings/components/moderation-kit';

import { isTopLive } from '../api';
import { TOP_REJECTION_REASON_MAX } from '../constants';

/**
 * One Top request and the single call that settles it.
 *
 * The thing this sheet exists to make unmissable is that approving is not
 * bookkeeping: `PATCH /admin/top-requests/{id}` settles the request AND writes
 * `is_featured`, `featured_until` and `promotion_weight` on the listing in the
 * same transaction. There is no separate "now promote it" step anywhere, so a
 * moderator who approves without meaning to has put a listing at the top of the
 * public catalogue. Hence the consequence line above the footer, spelled with
 * the duration that is actually about to be granted rather than in the
 * abstract, and hence both buttons sitting behind a confirm.
 *
 * The duration and the priority default to what the owner asked for and to the
 * same 100 the manual promote on the listings screen starts from — the bounds
 * are imported from that screen's constants rather than redeclared, because
 * both surfaces write the same two columns and the backend answers a value
 * outside 1..365 / 0..1000 with a 422 rather than clamping it.
 *
 * Mount with `key={row.id}` — the inputs are local state seeded from the row.
 */

interface ReviewTopRequestSheetProps {
  row: AdminTopRequestRow;
  onClose: () => void;
  onApprove: (days: number, promotionWeight: number) => void;
  onReject: (rejectionReason: string) => void;
  approving: boolean;
  rejecting: boolean;
  /** False for a rank below MODERATOR: the sheet becomes read-only. */
  canReview: boolean;
  /** Guarded translator — a status the catalogue misses prints its wire value. */
  statusLabel: (status: string) => string;
}

export function ReviewTopRequestSheet({
  row,
  onClose,
  onApprove,
  onReject,
  approving,
  rejecting,
  canReview,
  statusLabel,
}: ReviewTopRequestSheetProps) {
  const t = useTranslations('topRequests');
  const c = useTranslations('common');
  // The owner block reuses `users.columns.phone` rather than inventing a second
  // label for the same field, exactly as ListingSheet does.
  const u = useTranslations('users');
  const locale = useLocale();
  const confirm = useConfirm();

  const [days, setDays] = useState(String(row.requestedDays));
  const [weight, setWeight] = useState(String(FEATURE_WEIGHT_DEFAULT));
  const [reason, setReason] = useState(row.rejectionReason ?? '');

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const showDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : c('never'));

  // Decided once, here: a request that has already been approved or rejected
  // answers 409 `top_request_already_reviewed`, so the buttons must not offer
  // a call the backend will refuse.
  const settled = row.status !== 'PENDING';
  const busy = approving || rejecting;
  const disabled = settled || !canReview || busy;
  const live = isTopLive(row);

  const grantedDays = clamp(Number(days), FEATURE_DAYS_MIN, FEATURE_DAYS_MAX, FEATURE_DAYS_DEFAULT);
  const grantedWeight = clamp(
    Number(weight),
    FEATURE_WEIGHT_MIN,
    FEATURE_WEIGHT_MAX,
    FEATURE_WEIGHT_DEFAULT,
  );
  const trimmedReason = reason.trim();

  const askThenApprove = async () => {
    const confirmed = await confirm({
      title: t('actions.approve'),
      message: `${t('review.approveConfirm')} — ${t('review.effect', { days: grantedDays })}`,
      confirmLabel: t('actions.approve'),
      cancelLabel: c('cancel'),
    });
    if (confirmed) onApprove(grantedDays, grantedWeight);
  };

  const askThenReject = async () => {
    const confirmed = await confirm({
      title: t('actions.reject'),
      message: t('review.rejectConfirm'),
      confirmLabel: t('actions.reject'),
      cancelLabel: c('cancel'),
      isDestructive: true,
    });
    if (confirmed) onReject(trimmedReason.slice(0, TOP_REJECTION_REASON_MAX));
  };

  return (
    <Sheet
      open
      onClose={onClose}
      closeLabel={c('close')}
      size="lg"
      title={t('review.title')}
      subtitle={row.listingTitle ?? c('unknown')}
      footer={
        canReview && !settled ? (
          <>
            <Button
              variant="danger"
              loading={rejecting}
              // The user is told why their request came back, and "no reason
              // given" is not an answer they can act on.
              disabled={busy || trimmedReason.length === 0}
              onClick={() => void askThenReject()}
            >
              {t('actions.reject')}
            </Button>
            <Button
              icon={<Star size={14} />}
              loading={approving}
              disabled={busy}
              onClick={() => void askThenApprove()}
            >
              {t('actions.approve')}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <StatusPill
          status={row.status}
          label={statusLabel(row.status)}
          pulse={row.status === 'PENDING'}
        />
        {live && <Badge variant="info" label={t('review.alreadyLive')} />}
      </div>

      {/* ── The listing ──────────────────────────────────────────────────────
          One photo, lazily decoded: on a legacy listing it is still a base64
          data URI of several megabytes, and the sheet has to open instantly. */}
      <SheetSection title={t('columns.listing')}>
        <div className="flex items-start gap-3">
          <Thumb src={row.listingImage} alt={row.listingTitle ?? ''} size={64} />
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}
            >
              {row.listingTitle ?? c('unknown')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {[
                row.listingDistrict,
                row.listingPrice === null ? null : numberFormat.format(row.listingPrice),
              ]
                .filter(Boolean)
                .join(' · ') || c('unknown')}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <KeyValue
            label={t('review.grantedUntil')}
            value={live ? showDate(row.listingFeaturedUntil) : c('no')}
          />
        </div>
      </SheetSection>

      {/* ── Who asked ───────────────────────────────────────────────────────── */}
      <SheetSection title={t('columns.owner')}>
        <div
          className="rounded-[var(--radius-md)] px-3.5 py-2"
          style={{ background: 'var(--color-surface-2)' }}
        >
          <p className="text-sm font-semibold pb-1" style={{ color: 'var(--color-text-primary)' }}>
            {row.ownerName ?? c('unknown')}
          </p>
          <KeyValue
            label={u('columns.phone')}
            value={
              row.ownerPhone ? (
                // Moderation on a phone means the next step is often a call.
                <a href={`tel:${row.ownerPhone}`} style={{ color: 'var(--accent)' }}>
                  {row.ownerPhone}
                </a>
              ) : (
                c('unknown')
              )
            }
          />
          <KeyValue
            label={t('review.requestedDays')}
            value={`${row.requestedDays} ${c('days')}`}
          />
          <KeyValue label={t('columns.created')} value={showDate(row.createdAt)} />
        </div>
        {row.note && (
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
            {row.note}
          </p>
        )}
      </SheetSection>

      {/* ── What was already decided ─────────────────────────────────────────
          Shown instead of the form once the request is settled: re-deciding it
          is a 409, so offering the inputs would only produce an error. */}
      {settled ? (
        <SheetSection title={c('details')}>
          {row.status === 'APPROVED' ? (
            <>
              <KeyValue
                label={t('review.days')}
                value={row.grantedDays === null ? c('unknown') : String(row.grantedDays)}
              />
              <KeyValue
                label={t('review.weight')}
                value={row.grantedWeight === null ? c('unknown') : String(row.grantedWeight)}
              />
              <KeyValue label={t('review.grantedUntil')} value={showDate(row.grantedUntil)} />
            </>
          ) : (
            <KeyValue label={t('review.reason')} value={row.rejectionReason ?? c('none')} />
          )}
          <KeyValue label={t('review.reviewedAt')} value={showDate(row.reviewedAt)} />
        </SheetSection>
      ) : (
        <>
          {/* ── The grant ───────────────────────────────────────────────────
              Real inputs rather than a fixed week: the backend accepts 1..365
              and 0..1000, and the moderator may well want to grant less than
              was asked for. Both start where the owner and the listings screen
              would put them. */}
          <SheetSection title={t('actions.approve')}>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('review.days')}
                type="number"
                inputMode="numeric"
                min={FEATURE_DAYS_MIN}
                max={FEATURE_DAYS_MAX}
                value={days}
                disabled={disabled}
                onChange={(event) => setDays(event.target.value)}
                hint={`${FEATURE_DAYS_MIN}–${FEATURE_DAYS_MAX}`}
              />
              <Input
                label={t('review.weight')}
                type="number"
                inputMode="numeric"
                min={FEATURE_WEIGHT_MIN}
                max={FEATURE_WEIGHT_MAX}
                value={weight}
                disabled={disabled}
                onChange={(event) => setWeight(event.target.value)}
                hint={`${FEATURE_WEIGHT_MIN}–${FEATURE_WEIGHT_MAX}`}
              />
            </div>

            {/* The whole point of the screen, said out loud. */}
            <p
              className="flex items-start gap-2 text-xs mt-3 p-3 rounded-[var(--radius-md)]"
              style={{
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Star
                size={13}
                className="shrink-0 mt-0.5"
                style={{ color: 'var(--accent)' }}
                aria-hidden="true"
              />
              {t('review.effect', { days: grantedDays })}
            </p>
          </SheetSection>

          <SheetSection title={t('review.reason')}>
            <Textarea
              value={reason}
              maxLength={TOP_REJECTION_REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('review.reasonPlaceholder')}
              aria-label={t('review.reason')}
              disabled={disabled}
              hint={`${trimmedReason.length} / ${TOP_REJECTION_REASON_MAX}`}
            />
          </SheetSection>
        </>
      )}
    </Sheet>
  );
}

/** Keep a typed number inside the range the backend validates, or fall back —
 *  an out-of-range value is a 422 there, never a clamp. */
function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
