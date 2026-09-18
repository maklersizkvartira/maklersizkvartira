'use client';

/** Kept as an address: the AI desk lives on /conversations now. */
import { ConversationsHub } from '@/features/conversations/ConversationsHub';

export default function ChatPage() {
  return <ConversationsHub initialTab="ai" />;
}
