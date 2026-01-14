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
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const hookId = useRef(Math.random().toString(36).substring(7));

  // Callbacks via refs to avoid dependency changes
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
  }, [onMessage, onOpen, onClose, onError]);

  const connect = useCallback(() => {
    if (!enabled) return;

    // 이미 연결되어 있으면 중복 연결 방지
    if (wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`[${hookId.current}] ✅ WebSocket 연결됨: ${url}`);
        reconnectAttemptsRef.current = 0;
        onOpenRef.current?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 실패:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket 에러:', error);
        onErrorRef.current?.(error);
      };

      ws.onclose = (event) => {
        console.log(`⚠️ WebSocket 연결 종료 (Code: ${event.code}, Clean: ${event.wasClean})`);
        onCloseRef.current?.();

        // 1000: Normal Closure (disconnect 호출 등) -> 재연결 X
        // 1001: Going Away (브라우저 종료 등)
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 10000); // Exponential backoff
          reconnectAttemptsRef.current += 1;

          console.log(`🔄 ${timeout}ms 후 WebSocket 재연결 시도... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, timeout);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.warn('⚠️ WebSocket 재연결 최대 횟수에 도달했습니다.');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ WebSocket 연결 실패:', error);
    }
  }, [url, enabled]); // Removed callback dependencies

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = 0;
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
    // 이미 연결되어 있으면 중복 연결 방지
    if (wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let isMounted = true;
    connect();

    return () => {
      isMounted = false;
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
