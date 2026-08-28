import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Route-level fallback for every page under the dashboard shell. It mirrors
 * the common page skeleton — header, KPI row, chart pair, table — so the
 * layout does not jump when the real page mounts.
 *
 * Built on the shared Skeleton (and therefore the shared .skeleton shimmer)
 * rather than a local pulse, so this and the in-page loading states of
 * DataTable and KpiCard breathe together instead of beating against each other.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width={180} height={22} radius="var(--radius-sm)" />
          <Skeleton width={260} height={12} radius="var(--radius-xs)" />
        </div>
        <Skeleton width={112} height={36} radius="var(--radius-md)" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5 flex flex-col gap-3">
            <Skeleton width={40} height={40} radius="var(--radius-md)" />
            <Skeleton width={96} height={12} radius="var(--radius-xs)" />
            <Skeleton width={128} height={26} radius="var(--radius-sm)" />
          </div>
        ))}
      </div>

      {/* Chart pair */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <Skeleton width={160} height={14} radius="var(--radius-xs)" />
          <Skeleton height={240} radius="var(--radius-md)" className="mt-4" />
        </div>
        <div className="card p-5">
          <Skeleton width={140} height={14} radius="var(--radius-xs)" />
          <Skeleton height={240} radius="var(--radius-md)" className="mt-4" />
        </div>
      </div>

      {/* Table */}
      <div className="card p-5">
        <Skeleton width={176} height={14} radius="var(--radius-xs)" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={44} radius="var(--radius-md)" />
          ))}
        </div>
      </div>
    </div>
  );
}
