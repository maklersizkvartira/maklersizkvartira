'use client';

/** The old address of the SMS screen: opens the notifications hub on its tab. */
import { NotificationsHub } from '@/features/hubs/NotificationsHub';

export default function SmsPage() {
  return <NotificationsHub initialTab="sms" />;
}
