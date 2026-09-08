'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

import { Link } from '@/i18n/routing';
import { useRole } from '@/providers/role-provider';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { PushScreen } from '@/features/push/components/PushScreen';

export default function PushPage() {
  const { isModerator, isAdmin } = useRole();
  const te = useTranslations('errors');

  if (!isModerator && !isAdmin) {
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

  return <PushScreen />;
}
