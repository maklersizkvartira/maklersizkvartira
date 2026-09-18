'use client';

/** The old address of the staff table: opens the system hub on its tab. */
import { SystemHub } from '@/features/hubs/SystemHub';

export default function StaffPage() {
  return <SystemHub initialTab="staff" />;
}
