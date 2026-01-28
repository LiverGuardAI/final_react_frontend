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

export interface ChatFile {
  file_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  download_url: string;
  is_image: boolean;
  is_video: boolean;
  file_exists: boolean;
  created_at: string;
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
  files?: ChatFile[];
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

/**
 * 파일 업로드 (이미지/파일)
 */
export const uploadFile = async (
  conversationId: number,
  file: File,
  body?: string
): Promise<Message> => {
  const formData = new FormData();
  formData.append('conversation_id', conversationId.toString());
  formData.append('file', file);
  if (body) {
    formData.append('body', body);
  }

  const res = await apiClient.post('chat/files/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};

/**
 * 파일 다운로드 URL 생성
 */
export const getFileDownloadUrl = (fileId: number): string => {
  const baseUrl = apiClient.defaults.baseURL || '';
  return `${baseUrl}chat/files/${fileId}/download/`;
};

/**
 * 파일 다운로드 (인증 포함)
 */
export const downloadFile = async (fileId: number, fileName: string): Promise<void> => {
  const res = await apiClient.get(`chat/files/${fileId}/download/`, {
    responseType: 'blob',
  });

  // Blob URL 생성 및 다운로드 트리거
  const blob = new Blob([res.data], { type: res.headers['content-type'] });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * 파일 Blob URL 가져오기 (이미지 미리보기용)
 */
export const getFileBlobUrl = async (fileId: number): Promise<string> => {
  const res = await apiClient.get(`chat/files/${fileId}/download/`, {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: res.headers['content-type'] });
  return window.URL.createObjectURL(blob);
};
