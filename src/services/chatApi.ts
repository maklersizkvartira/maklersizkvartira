import { http } from './http';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string;
  user_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  user?: any;
  owner?: any;
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
