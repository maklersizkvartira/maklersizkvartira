'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeCheck, FileText, ScanFace, ShieldAlert, ShieldCheck, X } from 'lucide-react';

import type { AdminVerificationRow, VerificationStatus } from '@/shared/api/types';
import type { VerificationListParams } from '@/shared/api/endpoints';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { useRole } from '@/providers/role-provider';
import { useConfirm } from '@/providers/confirm-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { Lightbox, TOUCH_BUTTONS, TOUCH_SELECT } from '@/features/listings/components/moderation-kit';
import {
  approveVerification,
  fetchVerifications,
  patchVerificationCache,
  rejectVerification,
  VERIFICATIONS_QUERY_KEY,
} from '@/features/verifications/api';
import {
  TRANSLATED_DOCUMENT_TYPES,
  TRANSLATED_VERIFICATION_STATUSES,
  VERIFICATIONS_PAGE_SIZE,
  VERIFICATION_STATUSES,
} from '@/features/verifications/constants';
import { RejectVerificationSheet } from '@/features/verifications/components/RejectVerificationSheet';

/**
 * Identity-verification requests: a photographed document, a selfie, and a
 * decision about whether they are the same person.
 *
 * The whole shape of this screen is dictated by one fact — `documentUrl` and
 * `selfieUrl` are each frequently an ~8,000,000-character base64 data URI, not
 * a URL. So: ten rows a page, nothing rendered as an image anywhere in the
 * table, and each document reachable only through a button that mounts a
 * lightbox on demand. Putting them in a thumbnail grid does not make the page
 * slow, it stops the browser responding.
 *
 * `status` is the only filter the route understands; it is a bare route
 * parameter compared upper-cased against the column, so an unknown value
 * answers with an empty page rather than an error.
 */

interface VerificationFilters extends AdminFilters {
  status: string;
}

const INITIAL: VerificationFilters = { status: '' };

/** What the lightbox is currently showing, if anything. */
interface Viewing {
  src: string;
  title: string;
}

export default function VerificationsPage() {
  const t = useTranslations('verifications');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const u = useTranslations('users');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { canAccess } = useRole();

  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const list = useAdminList<AdminVerificationRow, VerificationFilters>({
    queryKey: VERIFICATIONS_QUERY_KEY,
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: VerificationListParams = {
        page,
        pageSize: VERIFICATIONS_PAGE_SIZE,
        status: (filters.status || undefined) as VerificationStatus | undefined,
      };
      const { data, meta } = await fetchVerifications(params, signal);
      return { rows: data, meta };
    },
  });

  const rejecting = list.rows.find((row) => row.id === rejectingId) ?? null;

  /* ── Mutations ────────────────────────────────────────────────────────────
     Merged into the cached rows rather than replacing them: the PATCH path does
     no join, so it answers with a null user name and phone every time. */

  const approve = useMutation({
    mutationFn: (id: string) => approveVerification(id),
    onSuccess: (row) => {
      patchVerificationCache(queryClient, row);
      toast.success(c('success'));
      // The approval raises the user's trust score and verification level, so
      // anything the users screen is holding about them is now stale.
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectVerification(id, reason),
    onSuccess: (row) => {
      patchVerificationCache(queryClient, row);
      toast.success(c('success'));
      setRejectingId(null);
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const statusLabel = (status: string) =>
    TRANSLATED_VERIFICATION_STATUSES.has(status)
      ? t(`status.${status}` as Parameters<typeof t>[0])
      : status;

  const documentTypeLabel = (type: string) =>
    TRANSLATED_DOCUMENT_TYPES.has(type)
      ? t(`documentType.${type}` as Parameters<typeof t>[0])
      : type.replace(/_/g, ' ');

  /**
   * Approving is irreversible in effect — it sets `is_verified`, raises
   * `verification_level` and adds 15 to the trust score, and no route in this
   * API undoes any of that. The catalogues have no sentence that says so, so
   * the dialog spells out the two concrete consequences alongside the existing
   * "check that the document and the selfie are the same person" warning.
   */
  const askThenApprove = async (row: AdminVerificationRow) => {
    const consequences = `${t('status.APPROVED')} · ${u('columns.trust')} +15`;
    const confirmed = await confirm({
      title: t('approve'),
      message: `${t('approveWarning')} — ${consequences}`,
      confirmLabel: t('approve'),
      cancelLabel: c('cancel'),
    });
    if (confirmed) approve.mutate(row.id);
  };

  const busyOn = (id: string) =>
    (approve.isPending && approve.variables === id) ||
    (reject.isPending && reject.variables?.id === id);

  const columns: Column<AdminVerificationRow>[] = [
    {
      key: 'user',
      header: t('columns.user'),
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {row.userName ?? c('unknown')}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {row.userPhone ?? c('unknown')}
          </p>
        </div>
      ),
    },
    {
      key: 'documentType',
      header: t('columns.type'),
      render: (row) => documentTypeLabel(row.documentType),
    },
    {
      key: 'document',
      header: t('columns.document'),
      render: (row) => (
        <ViewButton
          label={t('viewDocument')}
          icon={<FileText size={13} />}
          src={row.documentUrl}
          title={`${row.userName ?? c('unknown')} · ${t('columns.document')}`}
          onView={setViewing}
          emptyLabel={c('none')}
        />
      ),
    },
    {
      key: 'selfie',
      header: t('columns.selfie'),
      render: (row) => (
        <ViewButton
          label={t('viewSelfie')}
          icon={<ScanFace size={13} />}
          src={row.selfieUrl}
          title={`${row.userName ?? c('unknown')} · ${t('columns.selfie')}`}
          onView={setViewing}
          emptyLabel={c('none')}
        />
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) => (
        <div className="inline-flex flex-col items-start gap-1">
          <StatusPill
            status={row.status}
            label={statusLabel(row.status)}
            pulse={row.status === 'PENDING'}
          />
          {row.rejectionReason && (
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}
            >
              {row.rejectionReason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('columns.submitted'),
      hideOnCard: true,
      render: (row) => dateFormat.format(new Date(row.createdAt)),
    },
    {
      key: 'actions',
      header: c('actions'),
      align: 'right',
      render: (row) => (
        <div className={`inline-flex flex-wrap justify-end gap-2 ${TOUCH_BUTTONS}`}>
          <Button
            size="sm"
            icon={<BadgeCheck size={13} />}
            disabled={row.status === 'APPROVED' || busyOn(row.id)}
            loading={approve.isPending && approve.variables === row.id}
            onClick={() => void askThenApprove(row)}
          >
            {t('approve')}
          </Button>
          {/* Rejecting an APPROVED request is one-way damage, not a
              correction: approving already set `is_verified`, raised
              `verification_level` and added 15 to the trust score, and
              rejecting afterwards writes `status = REJECTED` and undoes none of
              it — leaving a rejected applicant verified on the public site.
              Only an ADMIN can repair that through PATCH /admin/users/{id},
              and the moderator who caused it gets no signal that it needs
              repairing. REJECTED stays enabled: the sheet prefills the existing
              reason, so amending one is a supported flow. */}
          <Button
            size="sm"
            variant="secondary"
            icon={<X size={13} />}
            disabled={row.status === 'APPROVED' || busyOn(row.id)}
            onClick={() => setRejectingId(row.id)}
          >
            {t('reject')}
          </Button>
        </div>
      ),
    },
  ];

  // The page's own gate, alongside the sidebar's.
  if (!canAccess('/verifications')) {
    return (
      <div className="card">
        <EmptyState icon={<ShieldAlert size={26} />} title={e('forbidden')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={countActiveFilters(list.filters, INITIAL)}
        onReset={list.resetFilters}
      >
        <Select
          className={TOUCH_SELECT}
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value, { immediate: true })}
          placeholder={t('columns.status')}
          options={[
            { value: '', label: c('all') },
            ...VERIFICATION_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
          ]}
        />
      </FilterBar>

      {/* Rows carry their own buttons, so the row itself is not clickable —
          DataTable renders a mobile card as a <button> when it is, and a button
          inside a button is invalid markup that phones handle badly. */}
      {/* A refetch that fails leaves the previous page on screen and says
          nothing — `keepPreviousData` holds those rows. The empty-state
          branch below never runs in that case, so the warning goes here. */}
      <ListErrorBanner
        error={list.rows.length > 0 ? list.error : null}
        title={c('error')}
        retryLabel={c('retry')}
        onRetry={list.refetch}
      />

      <div
        style={{
          opacity: list.isFetching && !list.isLoading ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <DataTable
          columns={columns}
          rows={list.rows}
          keyOf={(row) => row.id}
          loading={list.isLoading}
          loadingRows={VERIFICATIONS_PAGE_SIZE}
          empty={
            <ListState
              icon={<ShieldCheck size={26} />}
              emptyTitle={c('noData')}
              errorTitle={c('error')}
              retryLabel={c('retry')}
              error={list.error}
              onRetry={list.refetch}
            />
          }
        />
      </div>

      <Pagination
        meta={list.meta}
        onPage={list.setPage}
        summary={(page, total) => c('pagination.pageOf', { page, total })}
        navLabel={c('pagination.label')}
        previousLabel={c('pagination.previousPage')}
        nextLabel={c('pagination.nextPage')}
      />

      {rejecting && (
        <RejectVerificationSheet
          key={rejecting.id}
          row={rejecting}
          onClose={() => setRejectingId(null)}
          onSubmit={(reason) => reject.mutate({ id: rejecting.id, reason })}
          onViewDocument={() =>
            rejecting.documentUrl &&
            setViewing({
              src: rejecting.documentUrl,
              title: `${rejecting.userName ?? ''} · ${t('columns.document')}`,
            })
          }
          onViewSelfie={() =>
            rejecting.selfieUrl &&
            setViewing({
              src: rejecting.selfieUrl,
              title: `${rejecting.userName ?? ''} · ${t('columns.selfie')}`,
            })
          }
          pending={reject.isPending}
          statusLabel={statusLabel}
          documentTypeLabel={documentTypeLabel}
        />
      )}

      {/* One image at a time, mounted only while open — see the note at the top
          of this file for why that is not merely an optimisation. */}
      <Lightbox
        open={viewing !== null}
        onClose={() => setViewing(null)}
        images={viewing ? [viewing.src] : []}
        index={0}
        onIndexChange={() => {}}
        title={viewing?.title}
        closeLabel={c('close')}
        previousLabel={c('previous')}
        nextLabel={c('next')}
      />
    </div>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────────────── */

/**
 * The only route to a verification image.
 *
 * It hands the source up to the page rather than rendering anything itself: an
 * `<img>` here would decode every document on the page the moment the table
 * paints, which is the failure mode this whole screen is built to avoid.
 */
function ViewButton({
  label,
  icon,
  src,
  title,
  onView,
  emptyLabel,
}: {
  label: string;
  icon: React.ReactNode;
  src: string | null;
  title: string;
  onView: (viewing: Viewing) => void;
  emptyLabel: string;
}) {
  if (!src) {
    return (
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {emptyLabel}
      </span>
    );
  }

  return (
    <span className={`inline-flex ${TOUCH_BUTTONS}`}>
      <Button size="sm" variant="secondary" icon={icon} onClick={() => onView({ src, title })}>
        {label}
      </Button>
    </span>
  );
}
