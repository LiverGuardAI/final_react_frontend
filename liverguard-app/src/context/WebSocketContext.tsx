import React, { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface WebSocketContextType {
  sendMessage: (message: any) => boolean;
  disconnect: () => void;
  reconnect: () => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  onQueueUpdate?: () => void;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, onQueueUpdate }) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  const WS_URL = `${protocol}//${hostname}:8000/ws/clinic/`;

  const handleMessage = useCallback((data: any) => {
    console.log('📨 WebSocket 메시지 수신:', data);

    if (data.type === 'queue_update') {
      console.log('🔔 대기열 업데이트 알림:', data.message);
      onQueueUpdate?.();
    }
  }, [onQueueUpdate]);

  const handleOpen = useCallback(() => {
    console.log('✅ WebSocket 연결 성공');
  }, []);

  const handleError = useCallback((error: Event) => {
    console.error('❌ WebSocket 에러:', error);
  }, []);

  const handleClose = useCallback(() => {
    console.log('⚠️ WebSocket 연결 종료 (5초 후 재연결 시도)');
  }, []);

  const { sendMessage, disconnect, reconnect, isConnected } = useWebSocket(WS_URL, {
    onMessage: handleMessage,
    onOpen: handleOpen,
    onError: handleError,
    onClose: handleClose,
    enabled: true,
  });

  return (
    <WebSocketContext.Provider value={{ sendMessage, disconnect, reconnect, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};
