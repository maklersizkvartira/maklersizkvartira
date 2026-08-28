import { http } from './http';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read_at: string | null;
  created_at: string;
}

/**
 * Enough of a listing to say which one a thread is about.
 *
 * No photo: listing images are base64 `data:` URIs, so a cover on every row
 * would be tens of megabytes for a line of text.
 */
export interface ConversationListing {
  id: string;
  title: string;
  district: string | null;
  region: string | null;
  rooms: number | null;
  price: number | null;
  currency: string | null;
  status: string | null;
}

export interface ChatParticipant {
  id: string;
  name?: string | null;
  avatar?: string | null;
  role?: string | null;
}

export interface Conversation {
  id: string;
  listing_id: string;
  user_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  user?: ChatParticipant | null;
  owner?: ChatParticipant | null;
  /** Which listing the two of them are talking about. */
  listing?: ConversationListing | null;
  /** Preview line, truncated server-side at 160 characters. */
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_is_mine?: boolean;
  /** Messages from the other person that have not been opened. */
  unread_count?: number;
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[];
}

export const chatApi = {
  listConversations: () =>
    http.get<Conversation[]>('/chat/conversations'),
    
  startOrGetConversation: (listingId: string) =>
    http.post<ConversationDetail>(`/chat/conversations/${listingId}`),
    
  getMessages: (conversationId: string) =>
    http.get<ConversationDetail>(`/chat/conversations/${conversationId}/messages`),
    
  sendMessage: (conversationId: string, text: string) =>
    http.post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, { text }),
    
  getUnreadCount: () =>
    http.get<{ count: number }>('/chat/unread-count'),
};
