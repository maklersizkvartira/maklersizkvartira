'use client';

/** The old address of the verifications page: opens the users hub on its tab. */
import { UsersHub } from '@/features/hubs/UsersHub';

export default function VerificationsPage() {
  return <UsersHub initialTab="verifications" />;
}
