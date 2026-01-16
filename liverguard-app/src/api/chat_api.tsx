// src/api/chat_api.ts
import apiClient from "./axiosConfig";

// Types
export interface ChatUser {
  user_id: number;
  username: string;
  role: string;
  department: string;
  name: string;
}

export interface ConversationOtherUser {
  user_id: number;
  username: string;
  role: string;
  name: string;
}

export interface LastMessage {
  message_id: number;
  body: string;
  sender_id: number;
  created_at: string;
}

export interface Conversation {
  conversation_id: number;
  type: 'DM' | 'GROUP';
  title: string | null;
  other_user: ConversationOtherUser | null;
  last_message: LastMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageSender {
  user_id: number;
  username: string;
  role: string;
  name: string;
}

export interface Message {
  message_id: number;
  conversation: number;
  sender: MessageSender;
  body: string;
  message_type: 'TEXT' | 'FILE' | 'MIXED' | 'SYSTEM';
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  is_mine: boolean;
}

// API Functions

/**
 * 채팅 가능한 사용자 목록 조회
 */
export const getChatUsers = async (department?: string): Promise<ChatUser[]> => {
  const params = department ? { department } : {};
  const res = await apiClient.get("chat/chat-users/", { params });
  return res.data;
};

/**
 * 대화방 목록 조회
 */
export const getConversations = async (): Promise<Conversation[]> => {
  const res = await apiClient.get("chat/conversations/");
  return res.data;
};

/**
 * 대화방 상세 조회
 */
export const getConversation = async (conversationId: number): Promise<Conversation> => {
  const res = await apiClient.get(`chat/conversations/${conversationId}/`);
  return res.data;
};

/**
 * DM 대화방 생성 또는 조회
 */
export const createOrGetDM = async (targetUserId: number): Promise<Conversation> => {
  const res = await apiClient.post("chat/conversations/create_dm/", {
    target_user_id: targetUserId
  });
  return res.data;
};

/**
 * 대화방 메시지 목록 조회
 */
export const getMessages = async (
  conversationId: number,
  limit: number = 50,
  beforeId?: number
): Promise<Message[]> => {
  const params: { limit: number; before?: number } = { limit };
  if (beforeId) {
    params.before = beforeId;
  }
  const res = await apiClient.get(`chat/conversations/${conversationId}/messages/`, { params });
  return res.data;
};

/**
 * 메시지 전송
 */
export const sendMessage = async (
  conversationId: number,
  body: string
): Promise<Message> => {
  const res = await apiClient.post(`chat/conversations/${conversationId}/send/`, {
    body,
    message_type: 'TEXT'
  });
  return res.data;
};

/**
 * 읽음 처리
 */
export const markAsRead = async (
  conversationId: number,
  messageId: number
): Promise<{ status: string }> => {
  const res = await apiClient.post(`chat/conversations/${conversationId}/mark_read/`, {
    message_id: messageId
  });
  return res.data;
};
