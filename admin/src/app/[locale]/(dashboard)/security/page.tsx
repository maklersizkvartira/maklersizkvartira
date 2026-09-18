'use client';

/** The old address of the login-attempts log: opens the system hub on its tab. */
import { SystemHub } from '@/features/hubs/SystemHub';

export default function SecurityPage() {
  return <SystemHub initialTab="security" />;
}
