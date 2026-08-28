'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { SmsScreen } from '@/features/sms/components/SmsScreen';

/**
 * `/sms` — ADMIN and above, matching `ROUTE_MIN_ROLE` and the `RequireAdmin`
 * dependency on `GET /admin/sms`. The log carries phone numbers, which is why
 * it sits a rung above the moderation queues.
 */
export default function SmsPage() {
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

  return <SmsScreen />;
}
