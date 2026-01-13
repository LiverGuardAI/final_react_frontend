import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

interface WebSocketContextType {
  sendMessage: (message: any) => boolean;
  disconnect: () => void;
  reconnect: () => void;
  isConnected: boolean;
  lastMessage: any | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [lastMessage, setLastMessage] = useState<any | null>(null);

  const WS_URL = React.useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000/ws/clinic/`;
  }, []);

  const handleMessage = useCallback((data: any) => {
    // console.log('Global WS Message:', data); 
    setLastMessage(data);
  }, []);

  const { sendMessage, disconnect, reconnect, isConnected } = useWebSocket(WS_URL, {
    onMessage: handleMessage,
    onOpen: () => console.log('✅ Global WebSocket Connected'),
    onClose: () => console.log('⚠️ Global WebSocket Disconnected'),
    enabled: isAuthenticated, // 오직 로그인 상태일 때만 연결
  });

  return (
    <WebSocketContext.Provider value={{ sendMessage, disconnect, reconnect, isConnected, lastMessage }}>
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
