'use client';

/** The old address of the push screen: opens the notifications hub on its tab. */
import { NotificationsHub } from '@/features/hubs/NotificationsHub';

export default function PushPage() {
  return <NotificationsHub initialTab="push" />;
}
