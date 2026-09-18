'use client';

/** Kept as an address: alerts and bookmarks still say /support. */
import { ConversationsHub } from '@/features/conversations/ConversationsHub';

export default function SupportPage() {
  return <ConversationsHub initialTab="support" />;
}
