'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, BedDouble, Eye, Flag, Ruler, Star, Trash2 } from 'lucide-react';

import type { AdminListingRow, ListingFeaturePayload } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Input, Textarea } from '@/shared/ui/Input';
import { useConfirm } from '@/providers/confirm-provider';

import type { ListingModerationBody } from '../api';
import { isFeaturedNow } from '../api';
import {
  APPROVE_STATUS,
  FEATURE_DAYS_DEFAULT,
  FEATURE_DAYS_MAX,
  FEATURE_DAYS_MIN,
  FEATURE_WEIGHT_DEFAULT,
  FEATURE_WEIGHT_MAX,
  FEATURE_WEIGHT_MIN,
  MODERATION_NOTE_MAX,
  REJECT_STATUS,
} from '../constants';
import {
  KeyValue,
  Lightbox,
  RiskPill,
  Sheet,
  SheetSection,
  Thumb,
  TOUCH_BUTTONS,
} from './moderation-kit';

/**
 * One listing, everything a moderator needs in order to decide about it, and
 * the three decisions they can make.
 *
 * Mount it with `key={row.id}` — the note, the promotion inputs and the delete
 * step are local state seeded from the row, so a different listing has to
 * arrive with a fresh form rather than the previous one's half-typed note.
 */

interface ListingSheetProps {
  row: AdminListingRow;
  onClose: () => void;
  onModerate: (body: ListingModerationBody) => void;
  onFeature: (body: ListingFeaturePayload) => void;
  onDelete: () => void;
  moderating: boolean;
  featuring: boolean;
  removing: boolean;
  canModerate: boolean;
  canFeature: boolean;
  canDelete: boolean;
  /** Guarded translator — a status the catalogues miss prints its wire value. */
  statusLabel: (status: string) => string;
}

export function ListingSheet({
  row,
  onClose,
  onModerate,
  onFeature,
  onDelete,
  moderating,
  featuring,
  removing,
  canModerate,
  canFeature,
  canDelete,
  statusLabel,
}: ListingSheetProps) {
  const t = useTranslations('listings');
  const c = useTranslations('common');
  // The owner block reuses `users.columns.*` rather than inventing a second
  // set of labels for phone / role / trust; they are the same three fields.
  const u = useTranslations('users');
  const locale = useLocale();
  const confirm = useConfirm();

  const [note, setNote] = useState(row.moderationNote ?? '');
  const [days, setDays] = useState(String(FEATURE_DAYS_DEFAULT));
  const [weight, setWeight] = useState(
    String(row.promotionWeight > 0 ? row.promotionWeight : FEATURE_WEIGHT_DEFAULT),
  );
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const showDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : c('never'));
  // `currency` is a free 3-char column, so it is appended rather than handed to
  // Intl as a currency code — an unknown code there throws a RangeError.
  const money = (value: number) => `${numberFormat.format(value)} ${row.currency}`;

  const featured = isFeaturedNow(row);
  const busy = moderating || featuring || removing;

  /**
   * The backend writes `moderation_note` unconditionally, so an empty box is a
   * deliberate "clear it" — there is no call shape that leaves the note alone.
   */
  const noteForWire = () => {
    const trimmed = note.trim();
    return trimmed.length > 0 ? trimmed.slice(0, MODERATION_NOTE_MAX) : null;
  };

  const decide = async (status: typeof APPROVE_STATUS | typeof REJECT_STATUS) => {
    const message =
      status === APPROVE_STATUS ? t('moderation.approveConfirm') : t('moderation.rejectConfirm');
    if (await confirm({ message, isDestructive: status === REJECT_STATUS })) {
      onModerate({ status, note: noteForWire() });
    }
  };

  const location = [row.district, row.address].filter(Boolean).join(', ');

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        closeLabel={c('close')}
        size="xl"
        title={row.title}
        subtitle={[row.district, money(row.price)].filter(Boolean).join(' · ')}
        footer={
          canModerate ? (
            <>
              <Button
                variant="danger"
                loading={moderating}
                disabled={busy}
                onClick={() => void decide(REJECT_STATUS)}
              >
                {t('actions.reject')}
              </Button>
              <Button
                loading={moderating}
                disabled={busy}
                onClick={() => void decide(APPROVE_STATUS)}
              >
                {t('actions.approve')}
              </Button>
            </>
          ) : undefined
        }
      >
        {/* ── Photos ───────────────────────────────────────────────────────
            A scroll strip of small lazy boxes, never a grid of full images:
            legacy rows carry base64 data URIs of several megabytes each, and
            the full-size decode happens only when one is tapped. */}
        <SheetSection title={t('columns.photo')}>
          {row.images.length === 0 ? (
            <div className="flex items-center gap-3">
              <Thumb src={null} alt="" size={64} />
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {c('noData')}
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {row.images.map((src, index) => (
                <button
                  key={`${index}-${src.slice(0, 24)}`}
                  type="button"
                  aria-label={`${c('view')} ${index + 1}`}
                  className="rounded-[var(--radius-sm)] active:scale-95 transition-transform shrink-0"
                  onClick={() => {
                    setGalleryIndex(index);
                    setLightboxOpen(true);
                  }}
                >
                  <Thumb src={src} alt={row.title} size={72} />
                </button>
              ))}
            </div>
          )}
        </SheetSection>

        {/* ── Verdict signals ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <StatusPill
            status={row.status}
            label={statusLabel(row.status)}
            pulse={row.status === 'PENDING' || row.status === 'UNDER_REVIEW'}
          />
          <RiskPill score={row.riskScore} label={t('moderation.riskScore')} />
          {featured && <Badge variant="info" label={t('columns.featured')} />}
          {row.safetyBadges.map((badge) => (
            <Badge key={badge} variant="neutral" label={badge.replace(/_/g, ' ')} />
          ))}
        </div>

        {/* ── AI risk reasons ──────────────────────────────────────────────
            Free-form strings written by the risk model, so they are printed as
            they arrive rather than looked up in the catalogues. */}
        {row.aiRiskReasons.length > 0 && (
          <SheetSection title={t('moderation.riskReasons')}>
            <ul className="flex flex-col gap-1.5">
              {row.aiRiskReasons.map((reason, index) => (
                <li
                  key={`${index}-${reason}`}
                  className="flex items-start gap-2 text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <AlertTriangle
                    size={13}
                    className="shrink-0 mt-1"
                    style={{ color: 'var(--color-warning)' }}
                    aria-hidden="true"
                  />
                  <span style={{ overflowWrap: 'anywhere' }}>{reason}</span>
                </li>
              ))}
            </ul>
          </SheetSection>
        )}

        {/* ── Counters ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Metric
            icon={<Eye size={13} aria-hidden="true" />}
            label={t('columns.views')}
            value={numberFormat.format(row.viewsCount)}
          />
          <Metric
            icon={<Flag size={13} aria-hidden="true" />}
            label={t('columns.reports')}
            value={numberFormat.format(row.reportCount)}
            alarming={row.reportCount > 0}
          />
        </div>

        {/* ── Owner ────────────────────────────────────────────────────────── */}
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
            <KeyValue label={u('columns.role')} value={row.ownerRole ?? c('unknown')} />
            <KeyValue
              label={u('columns.trust')}
              value={row.ownerTrustScore === null ? c('unknown') : String(row.ownerTrustScore)}
            />
          </div>
        </SheetSection>

        {/* ── Facts ────────────────────────────────────────────────────────── */}
        <SheetSection title={c('details')}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Chip icon={<BedDouble size={13} aria-hidden="true" />} value={String(row.rooms)} />
            {row.area !== null && (
              <Chip icon={<Ruler size={13} aria-hidden="true" />} value={`${row.area} m²`} />
            )}
          </div>
          <KeyValue label={t('columns.price')} value={money(row.price)} />
          <KeyValue label={t('columns.district')} value={location || c('unknown')} />
          <KeyValue label={t('columns.created')} value={showDate(row.createdAt)} />
          <KeyValue
            label={t('moderation.featuredUntil')}
            value={featured ? showDate(row.featuredUntil) : c('no')}
          />
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

        {/* ── Moderation note ─────────────────────────────────────────────── */}
        <SheetSection title={t('moderation.note')}>
          <Textarea
            value={note}
            maxLength={MODERATION_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('moderation.notePlaceholder')}
            aria-label={t('moderation.note')}
            disabled={!canModerate || busy}
          />
        </SheetSection>

        {/* ── Promotion ────────────────────────────────────────────────────
            `days` and `promotionWeight` are real inputs because the backend
            accepts 1..365 and 0..1000, and the panel this replaces sent 7 and
            10 for every listing it ever promoted. Both are ignored when
            unfeaturing: the backend zeroes the weight and clears the date. */}
        {canFeature && (
          <SheetSection title={t('actions.feature')}>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('moderation.featureDays')}
                type="number"
                inputMode="numeric"
                min={FEATURE_DAYS_MIN}
                max={FEATURE_DAYS_MAX}
                value={days}
                disabled={busy}
                onChange={(event) => setDays(event.target.value)}
                hint={`${FEATURE_DAYS_MIN}–${FEATURE_DAYS_MAX}`}
              />
              <Input
                label={t('moderation.promotionWeight')}
                type="number"
                inputMode="numeric"
                min={FEATURE_WEIGHT_MIN}
                max={FEATURE_WEIGHT_MAX}
                value={weight}
                disabled={busy}
                onChange={(event) => setWeight(event.target.value)}
                hint={`${FEATURE_WEIGHT_MIN}–${FEATURE_WEIGHT_MAX}`}
              />
            </div>

            <div className={`flex flex-col sm:flex-row gap-2.5 mt-3 ${TOUCH_BUTTONS}`}>
              <Button
                variant="secondary"
                icon={<Star size={14} />}
                loading={featuring}
                disabled={busy}
                onClick={() =>
                  onFeature({
                    isFeatured: true,
                    days: clamp(Number(days), FEATURE_DAYS_MIN, FEATURE_DAYS_MAX, FEATURE_DAYS_DEFAULT),
                    promotionWeight: clamp(
                      Number(weight),
                      FEATURE_WEIGHT_MIN,
                      FEATURE_WEIGHT_MAX,
                      FEATURE_WEIGHT_DEFAULT,
                    ),
                  })
                }
              >
                {t('actions.feature')}
              </Button>
              {featured && (
                <Button
                  variant="ghost"
                  loading={featuring}
                  disabled={busy}
                  onClick={() => onFeature({ isFeatured: false })}
                >
                  {t('actions.unfeature')}
                </Button>
              )}
            </div>
          </SheetSection>
        )}

        {/* ── Delete ───────────────────────────────────────────────────────
            ADMIN+ on the backend, and there is no undelete route — so it is
            deliberately two taps in two different places: the button below
            opens a panel, and the panel's own button is the one that fires. */}
        {canDelete && (
          <SheetSection title={t('actions.delete')}>
            {confirmingDelete ? (
              <div
                className="rounded-[var(--radius-md)] p-3.5"
                style={{
                  background: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger-border)',
                }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
                  {t('moderation.deleteConfirm')}
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('moderation.deleteWarning')}
                </p>
                <div className={`flex flex-col sm:flex-row gap-2.5 mt-3.5 ${TOUCH_BUTTONS}`}>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    loading={removing}
                    disabled={busy}
                    onClick={onDelete}
                  >
                    {c('delete')}
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                    {c('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className={TOUCH_BUTTONS}>
                <Button
                  variant="secondary"
                  icon={<Trash2 size={14} />}
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  {t('actions.delete')}
                </Button>
              </div>
            )}
          </SheetSection>
        )}
      </Sheet>

      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={row.images}
        index={galleryIndex}
        onIndexChange={setGalleryIndex}
        title={row.title}
        closeLabel={c('close')}
        previousLabel={c('previous')}
        nextLabel={c('next')}
      />
    </>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────────────── */

function Metric({
  icon,
  label,
  value,
  alarming = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  alarming?: boolean;
}) {
  return (
    <div
      className="rounded-[var(--radius-md)] px-3 py-2.5"
      style={{
        background: alarming ? 'var(--color-danger-bg)' : 'var(--color-surface-2)',
        border: alarming ? '1px solid var(--color-danger-border)' : '1px solid transparent',
      }}
    >
      <div
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ color: alarming ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="text-base font-bold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

/**
 * Rooms and floor area. Neither has a label in the catalogues, so the icon
 * carries the category and the value carries its own unit — printing them under
 * a borrowed label would be worse than printing them under none.
 */
function Chip({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
    >
      {icon}
      {value}
    </span>
  );
}

/** Keep a typed number inside the range the backend validates, or fall back —
 *  an out-of-range value is a 422 there, never a clamp. */
function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
