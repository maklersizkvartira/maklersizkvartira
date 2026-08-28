'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { StaffScreen } from '@/features/staff/components/StaffScreen';

/**
 * `/staff` — SUPERADMIN only, matching `ROUTE_MIN_ROLE` and the backend's own
 * `RequireSuperadmin` on every route this screen calls.
 *
 * The gate lives here rather than inside `StaffScreen` so no request is even
 * built for an account that cannot read the answer: an ADMIN who follows a
 * bookmark gets this card instead of a table wired to four 403s. The sidebar
 * already hides the link; this is the half of the pair that survives a URL
 * typed by hand.
 */
export default function StaffPage() {
  const { isSuperadmin } = useRole();
  const te = useTranslations('errors');

  if (!isSuperadmin) {
    return (
      <div className="card">
        <EmptyState
          icon={<Lock size={26} />}
          title={te('forbidden')}
          action={
            <Link href="/dashboard">
              <Button variant="secondary">{te('backToDashboard')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return <StaffScreen />;
}
