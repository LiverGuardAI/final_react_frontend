import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export const useWebSocket = (url: string, options: UseWebSocketOptions = {}) => {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    enabled = true,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`✅ WebSocket 연결됨: ${url}`);
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 실패:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket 에러:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('⚠️ WebSocket 연결 종료');
        onClose?.();

        // 5초 후 자동 재연결 시도
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 WebSocket 재연결 시도...');
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ WebSocket 연결 실패:', error);
    }
  }, [url, enabled, onMessage, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket이 연결되지 않았습니다.');
    return false;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendMessage,
    disconnect,
    reconnect: connect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};
