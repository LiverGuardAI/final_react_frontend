import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getConversations,
  getMessages,
  markAsRead,
} from '../api/chat_api';
import type { Conversation, Message } from '../api/chat_api';

interface ChatContextType {
  conversations: Conversation[];
  totalUnreadCount: number;
  isConnected: boolean;
  loadConversations: () => Promise<void>;
  updateConversationWithNewMessage: (conversationId: number, message: any) => void;
  markConversationAsRead: (conversationId: number, messageId: number) => Promise<void>;
  getMessagesForConversation: (conversationId: number) => Promise<Message[]>;
  sendMessage: (conversationId: number, body: string) => void;
  editMessage: (messageId: number, body: string) => void;
  deleteMessage: (messageId: number) => void;
  addMessageListener: (conversationId: number, callback: (message: any) => void) => void;
  removeMessageListener: (conversationId: number) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}

interface ChatProviderProps {
  children: ReactNode;
}

// 싱글톤 WebSocket 관리 (컴포넌트 외부에서 관리)
let globalChatWs: WebSocket | null = null;
let globalChatWsConnecting = false;
let globalChatWsListeners: Set<(data: any) => void> = new Set();
let globalReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let globalHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
let globalReconnectAttempts = 0; // 재연결 시도 횟수 (백오프용)
let globalOnStateChange: ((connected: boolean) => void) | null = null; // 상태 변경 콜백 저장
let globalTokenRefreshing = false; // 토큰 갱신 중 플래그 (레이스 컨디션 방지)

function getGlobalChatWs() {
  return globalChatWs;
}

// JWT 토큰 만료 여부 확인 (만료 1분 전이면 갱신 필요로 판단)
function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // 초 -> 밀리초
    const now = Date.now();
    const oneMinute = 60 * 1000;
    return exp - now < oneMinute;
  } catch {
    return true; // 파싱 실패 시 갱신 필요
  }
}

// 토큰 갱신 함수
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    console.log('[ChatWS] No refresh token available');
    return null;
  }

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/';
    const response = await fetch(`${baseUrl}auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      console.log('[ChatWS] ✅ Token refreshed successfully');
      return data.access;
    } else {
      console.log('[ChatWS] Token refresh failed:', response.status);
      return null;
    }
  } catch (error) {
    console.error('[ChatWS] Token refresh error:', error);
    return null;
  }
}

async function connectGlobalChatWs(onStateChange: (connected: boolean) => void) {
  // 콜백 저장 (재연결 시 사용)
  globalOnStateChange = onStateChange;

  // 이미 연결 중이거나 연결됨 (CONNECTING 상태도 체크)
  if (globalChatWsConnecting) {
    console.log('[ChatWS] Already connecting, skipping...');
    return;
  }
  if (globalChatWs && (globalChatWs.readyState === WebSocket.OPEN || globalChatWs.readyState === WebSocket.CONNECTING)) {
    console.log(`[ChatWS] Already connected or connecting (state: ${globalChatWs.readyState}), skipping...`);
    return;
  }

  // 토큰 갱신 중이면 대기 (레이스 컨디션 방지)
  if (globalTokenRefreshing) {
    console.log('[ChatWS] Token refreshing, skipping...');
    return;
  }

  // 항상 최신 토큰 사용 (재연결 시 오래된 토큰 방지)
  let token = localStorage.getItem('access_token');
  if (!token) {
    console.log('[ChatWS] No token, skipping...');
    return;
  }

  // 토큰 만료 임박 시 갱신
  if (isTokenExpiringSoon(token)) {
    console.log('[ChatWS] Token expiring soon, refreshing...');
    globalTokenRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        token = newToken;
      } else {
        console.log('[ChatWS] Token refresh failed, skipping connection');
        return;
      }
    } finally {
      globalTokenRefreshing = false;
    }
  }

  globalChatWsConnecting = true;

  const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';
  const wsUrl = `${wsBaseUrl}/ws/chat/?token=${token}`;

  // 토큰의 만료 시간 로깅 (디버깅용)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expDate = new Date(payload.exp * 1000);
    console.log(`[ChatWS] Connecting with token exp: ${expDate.toLocaleTimeString()}`)
  } catch {
    console.log('[ChatWS] Connecting...');
  }

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[ChatWS] ✅ Connected');
    globalChatWs = ws;
    globalChatWsConnecting = false;
    globalReconnectAttempts = 0; // 연결 성공 시 백오프 리셋
    onStateChange(true);

    // Heartbeat 시작 (30초마다 ping 전송)
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval);
    }
    globalHeartbeatInterval = setInterval(() => {
      if (globalChatWs && globalChatWs.readyState === WebSocket.OPEN) {
        globalChatWs.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[ChatWS] 📩 Message:', data.type);
      globalChatWsListeners.forEach(listener => listener(data));
    } catch (error) {
      console.error('[ChatWS] Parse error:', error);
    }
  };

  ws.onerror = () => {
    console.error('[ChatWS] ❌ Error');
    globalChatWsConnecting = false;
  };

  ws.onclose = (event) => {
    console.log(`[ChatWS] ⚠️ Closed (code: ${event.code})`);

    // Heartbeat 정리
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval);
      globalHeartbeatInterval = null;
    }

    globalChatWs = null;
    globalChatWsConnecting = false;
    onStateChange(false);

    // 비정상 종료시 재연결 (점진적 백오프: 3초 → 6초 → 12초 → 최대 30초)
    if (event.code !== 1000 && event.code !== 1005) {
      if (globalReconnectTimeout) {
        clearTimeout(globalReconnectTimeout);
      }

      const baseDelay = 3000; // 3초 시작
      const maxDelay = 30000; // 최대 30초
      const delay = Math.min(baseDelay * Math.pow(2, globalReconnectAttempts), maxDelay);

      globalReconnectAttempts++;

      globalReconnectTimeout = setTimeout(async () => {
        console.log(`[ChatWS] 🔄 Reconnecting... (attempt ${globalReconnectAttempts}, delay ${delay}ms)`);
        // 저장된 콜백 사용 (재연결 시에도 동일한 콜백 유지)
        if (globalOnStateChange) {
          await connectGlobalChatWs(globalOnStateChange);
        }
      }, delay);
    }
  };
}

function disconnectGlobalChatWs() {
  if (globalHeartbeatInterval) {
    clearInterval(globalHeartbeatInterval);
    globalHeartbeatInterval = null;
  }
  if (globalReconnectTimeout) {
    clearTimeout(globalReconnectTimeout);
    globalReconnectTimeout = null;
  }
  if (globalChatWs && globalChatWs.readyState === WebSocket.OPEN) {
    globalChatWs.close(1000);
  }
  globalChatWs = null;
  globalChatWsConnecting = false;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messageListenersRef = useRef<Map<number, (message: any) => void>>(new Map());
  const mountedRef = useRef(true);

  // 현재 사용자 ID
  const getCurrentUserId = (): number => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // 서버 응답에서 'id'로 저장됨 (user_id가 아님)
        return user.id || user.user_id || 0;
      }
    } catch {
      // JSON 파싱 실패 시
    }
    return 0;
  };

  // 총 읽지 않은 메시지 수
  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  // 대화방 목록 로드
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      if (mountedRef.current) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  // 새 메시지로 대화방 업데이트
  const updateConversationWithNewMessage = useCallback((conversationId: number, message: any) => {
    const currentUserId = getCurrentUserId();

    console.log('[ChatContext] updateConversationWithNewMessage:', {
      conversationId,
      message_sender_id: message.sender_id,
      message_sender_id_type: typeof message.sender_id,
      currentUserId,
      currentUserId_type: typeof currentUserId,
      isViewing: messageListenersRef.current.has(conversationId)
    });

    setConversations(prev => {
      const existingConvIndex = prev.findIndex(c => c.conversation_id === conversationId);

      if (existingConvIndex === -1) {
        loadConversations();
        return prev;
      }

      const updated = [...prev];
      const conv = { ...updated[existingConvIndex] };

      conv.last_message = {
        message_id: message.message_id,
        body: message.body,
        sender_id: message.sender_id,
        created_at: message.created_at
      };
      conv.updated_at = message.created_at;

      // 다른 사용자가 보낸 메시지이고, 해당 대화방을 열고 있지 않으면 unread 증가
      // Number() 변환으로 타입 불일치 문제 해결
      const isFromOther = Number(message.sender_id) !== Number(currentUserId);
      const isNotViewing = !messageListenersRef.current.has(conversationId);

      console.log('[ChatContext] Unread check:', { isFromOther, isNotViewing, willIncrease: isFromOther && isNotViewing });

      if (isFromOther && isNotViewing) {
        conv.unread_count = (conv.unread_count || 0) + 1;
        console.log('[ChatContext] 📬 Unread increased:', conv.unread_count);
      }

      updated[existingConvIndex] = conv;

      return updated.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [loadConversations]);

  // 읽음 처리
  const markConversationAsRead = useCallback(async (conversationId: number, messageId: number) => {
    try {
      await markAsRead(conversationId, messageId);
      if (mountedRef.current) {
        setConversations(prev => prev.map(conv =>
          conv.conversation_id === conversationId
            ? { ...conv, unread_count: 0 }
            : conv
        ));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  // 메시지 목록 가져오기
  const getMessagesForConversation = useCallback(async (conversationId: number): Promise<Message[]> => {
    try {
      return await getMessages(conversationId);
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }, []);

  // WebSocket으로 메시지 전송
  const sendMessage = useCallback((conversationId: number, body: string) => {
    const ws = getGlobalChatWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'send_message',
        conversation_id: conversationId,
        body: body
      }));

      // 낙관적 업데이트: 보낸 사람의 대화 목록도 즉시 업데이트
      const currentUserId = getCurrentUserId();
      setConversations(prev => {
        const existingConvIndex = prev.findIndex(c => c.conversation_id === conversationId);
        if (existingConvIndex === -1) return prev;

        const updated = [...prev];
        const conv = { ...updated[existingConvIndex] };
        const now = new Date().toISOString();

        conv.last_message = {
          message_id: -Date.now(), // 임시 ID
          body: body,
          sender_id: currentUserId,
          created_at: now
        };
        conv.updated_at = now;

        updated[existingConvIndex] = conv;

        // 최신 대화가 맨 위로 오도록 정렬
        return updated.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    } else {
      console.error('[ChatContext] WebSocket is not connected');
    }
  }, []);

  // WebSocket으로 메시지 수정
  const editMessage = useCallback((messageId: number, body: string) => {
    const ws = getGlobalChatWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        action: 'edit_message',
        message_id: messageId,
        body: body
      };
      console.log('[ChatContext] ✏️ Sending edit_message:', payload);
      ws.send(JSON.stringify(payload));
    } else {
      console.error('[ChatContext] WebSocket is not connected');
    }
  }, []);

  // WebSocket으로 메시지 삭제
  const deleteMessage = useCallback((messageId: number) => {
    const ws = getGlobalChatWs();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const payload = {
        action: 'delete_message',
        message_id: messageId
      };
      console.log('[ChatContext] 🗑️ Sending delete_message:', payload);
      ws.send(JSON.stringify(payload));
    } else {
      console.error('[ChatContext] WebSocket is not connected');
    }
  }, []);

  // 메시지 리스너 등록
  const addMessageListener = useCallback((conversationId: number, callback: (message: any) => void) => {
    messageListenersRef.current.set(conversationId, callback);
  }, []);

  // 메시지 리스너 제거
  const removeMessageListener = useCallback((conversationId: number) => {
    messageListenersRef.current.delete(conversationId);
  }, []);

  // WebSocket 메시지 핸들러
  useEffect(() => {
    const handleWsMessage = (data: any) => {
      if (!mountedRef.current) return;

      if (data.type === 'new_message') {
        const message = data.message;
        const conversationId = message.conversation_id;

        // 해당 대화방 리스너가 있으면 호출
        const listener = messageListenersRef.current.get(conversationId);
        if (listener) {
          listener({ type: 'new_message', ...message });
        }

        // 대화방 목록 업데이트
        updateConversationWithNewMessage(conversationId, message);
      } else if (data.type === 'message_edited') {
        // 수정 이벤트 - 해당 대화방 리스너에 전달
        console.log('[ChatContext] message_edited received:', data);
        const listener = messageListenersRef.current.get(data.conversation_id);
        console.log('[ChatContext] Listener for conversation', data.conversation_id, ':', listener ? 'exists' : 'not found');
        if (listener) {
          listener({ type: 'message_edited', ...data });
        }

        // 마지막 메시지가 수정된 경우 대화방 목록 업데이트
        if (data.is_last_message) {
          setConversations(prev => prev.map(conv => {
            if (conv.conversation_id === data.conversation_id && conv.last_message) {
              return {
                ...conv,
                last_message: {
                  ...conv.last_message,
                  body: data.body?.substring(0, 50) || conv.last_message.body
                }
              };
            }
            return conv;
          }));
        }
      } else if (data.type === 'message_deleted') {
        // 삭제 이벤트 - 해당 대화방 리스너에 전달
        console.log('[ChatContext] message_deleted received:', data);
        const listener = messageListenersRef.current.get(data.conversation_id);
        console.log('[ChatContext] Listener for conversation', data.conversation_id, ':', listener ? 'exists' : 'not found');
        if (listener) {
          listener({ type: 'message_deleted', ...data });
        }

        // 대화방 목록의 last_message 업데이트
        if (data.new_last_message !== undefined) {
          setConversations(prev => prev.map(conv => {
            if (conv.conversation_id === data.conversation_id) {
              return {
                ...conv,
                last_message: data.new_last_message
              };
            }
            return conv;
          }));
        }
      } else if (data.type === 'new_conversation') {
        loadConversations();
      }
    };

    globalChatWsListeners.add(handleWsMessage);

    return () => {
      globalChatWsListeners.delete(handleWsMessage);
    };
  }, [updateConversationWithNewMessage, loadConversations]);

  // WebSocket 연결 관리
  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated) {
      disconnectGlobalChatWs();
      return () => {
        mountedRef.current = false;
      };
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      disconnectGlobalChatWs();
      return () => {
        mountedRef.current = false;
      };
    }

    // 대화방 목록 로드
    loadConversations();

    // WebSocket 연결 - 즉시 연결 시도 (싱글톤이 중복 연결 방지)
    const tryConnect = async () => {
      if (!mountedRef.current) return;

      // 이미 연결되어 있으면 스킵
      if (globalChatWs && globalChatWs.readyState === WebSocket.OPEN) {
        setIsConnected(true);
        return;
      }

      await connectGlobalChatWs((connected) => {
        if (mountedRef.current) {
          setIsConnected(connected);
        }
      });
    };

    // 즉시 연결 (싱글톤 패턴이 중복 연결 방지)
    tryConnect();

    // 페이지 언로드 시 WebSocket 정상 종료
    const handleBeforeUnload = () => {
      disconnectGlobalChatWs();
    };
    const handlePageHide = () => {
      disconnectGlobalChatWs();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      // 싱글톤 WebSocket은 cleanup에서 끊지 않음 (StrictMode 이중 마운트 대응)
      // 로그아웃 시 isAuthenticated가 false가 되어 위에서 disconnectGlobalChatWs() 호출됨
      // 페이지 언로드 시 beforeunload/pagehide 이벤트에서 연결 종료됨
    };
  }, [loadConversations, isAuthenticated]);

  return (
    <ChatContext.Provider value={{
      conversations,
      totalUnreadCount,
      isConnected,
      loadConversations,
      updateConversationWithNewMessage,
      markConversationAsRead,
      getMessagesForConversation,
      sendMessage,
      editMessage,
      deleteMessage,
      addMessageListener,
      removeMessageListener,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
