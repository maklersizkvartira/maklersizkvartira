'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { SecurityScreen } from '@/features/security/components/SecurityScreen';

/**
 * `/security` — ADMIN and above, matching `ROUTE_MIN_ROLE` and the backend's
 * `RequireAdmin` on `GET /admin/security/login-attempts`.
 *
 * Gating the route as well as the nav link is the point: a MODERATOR who
 * follows a bookmark would otherwise land on a table whose only possible
 * content is a 403 it cannot act on.
 */
export default function SecurityPage() {
  const { isAdmin } = useRole();
  const te = useTranslations('errors');

  if (!isAdmin) {
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

  return <SecurityScreen />;
}
