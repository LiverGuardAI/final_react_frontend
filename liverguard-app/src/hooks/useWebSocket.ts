import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

// URL별 싱글톤 WebSocket 관리 (토큰 제외한 기본 URL을 키로 사용)
const globalWebSockets: Map<string, WebSocket | null> = new Map();
const globalConnecting: Map<string, boolean> = new Map();
const globalListeners: Map<string, Set<(data: any) => void>> = new Map();
const globalReconnectTimeouts: Map<string, ReturnType<typeof setTimeout> | null> = new Map();
const globalStateListeners: Map<string, Set<(connected: boolean) => void>> = new Map();
const globalHeartbeatIntervals: Map<string, ReturnType<typeof setInterval> | null> = new Map();
const globalReconnectAttempts: Map<string, number> = new Map(); // 재연결 시도 횟수 (백오프용)
let globalTokenRefreshing = false; // 토큰 갱신 중 플래그 (레이스 컨디션 방지)

// URL에서 토큰을 제외한 기본 경로 추출 (Map 키로 사용)
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('token');
    return urlObj.toString();
  } catch {
    return url;
  }
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
    console.log('[ClinicWS] No refresh token available');
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
      console.log('[ClinicWS] ✅ Token refreshed successfully');
      return data.access;
    } else {
      console.log('[ClinicWS] Token refresh failed:', response.status);
      return null;
    }
  } catch (error) {
    console.error('[ClinicWS] Token refresh error:', error);
    return null;
  }
}

// URL에서 토큰을 갱신된 토큰으로 교체
function updateUrlWithNewToken(url: string, newToken: string): string {
  const urlObj = new URL(url);
  urlObj.searchParams.set('token', newToken);
  return urlObj.toString();
}

function getOrCreateListenerSet(url: string): Set<(data: any) => void> {
  if (!globalListeners.has(url)) {
    globalListeners.set(url, new Set());
  }
  return globalListeners.get(url)!;
}

function getOrCreateStateListenerSet(url: string): Set<(connected: boolean) => void> {
  if (!globalStateListeners.has(url)) {
    globalStateListeners.set(url, new Set());
  }
  return globalStateListeners.get(url)!;
}

async function connectGlobalWebSocket(url: string) {
  // 기본 URL을 키로 사용 (토큰 제외)
  const baseUrl = getBaseUrl(url);

  // 이미 연결 중이거나 연결됨 (CONNECTING 상태도 체크)
  const existingWs = globalWebSockets.get(baseUrl);
  if (globalConnecting.get(baseUrl)) {
    console.log(`[ClinicWS] Already connecting, skipping...`);
    return;
  }
  if (existingWs && (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) {
    console.log(`[ClinicWS] Already connected or connecting (state: ${existingWs.readyState}), skipping...`);
    return;
  }

  // 토큰 갱신 중이면 대기 (레이스 컨디션 방지)
  if (globalTokenRefreshing) {
    console.log('[ClinicWS] Token refreshing, skipping...');
    return;
  }

  // 항상 최신 토큰 사용 (재연결 시 오래된 토큰 방지)
  const currentToken = localStorage.getItem('access_token');
  if (!currentToken) {
    console.log('[ClinicWS] No token available, skipping connection');
    return;
  }

  // 토큰 만료 임박 시 갱신
  let token = currentToken;
  if (isTokenExpiringSoon(token)) {
    console.log('[ClinicWS] Token expiring soon, refreshing...');
    globalTokenRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        token = newToken;
      } else {
        console.log('[ClinicWS] Token refresh failed, skipping connection');
        return;
      }
    } finally {
      globalTokenRefreshing = false;
    }
  }

  // 최신 토큰으로 URL 생성
  const actualUrl = updateUrlWithNewToken(baseUrl + '?token=placeholder', token);

  globalConnecting.set(baseUrl, true);

  console.log(`[ClinicWS] Connecting to ${baseUrl.includes('/ws/clinic/') ? 'Clinic' : 'Unknown'} WebSocket...`);

  const ws = new WebSocket(actualUrl);

  ws.onopen = () => {
    console.log(`[ClinicWS] ✅ Connected`);
    globalWebSockets.set(baseUrl, ws);
    globalConnecting.set(baseUrl, false);
    globalReconnectAttempts.set(baseUrl, 0); // 연결 성공 시 백오프 리셋

    // 상태 리스너들에게 알림
    getOrCreateStateListenerSet(baseUrl).forEach(listener => listener(true));

    // Heartbeat 시작 (30초마다 ping 전송)
    const existingInterval = globalHeartbeatIntervals.get(baseUrl);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    const heartbeatInterval = setInterval(() => {
      const currentWs = globalWebSockets.get(baseUrl);
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    globalHeartbeatIntervals.set(baseUrl, heartbeatInterval);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      getOrCreateListenerSet(baseUrl).forEach(listener => listener(data));
    } catch (error) {
      console.error('[ClinicWS] Parse error:', error);
    }
  };

  ws.onerror = () => {
    console.error('[ClinicWS] ❌ Error');
    globalConnecting.set(baseUrl, false);
  };

  ws.onclose = (event) => {
    console.log(`[ClinicWS] ⚠️ Closed (code: ${event.code})`);

    // Heartbeat 정리
    const heartbeatInterval = globalHeartbeatIntervals.get(baseUrl);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      globalHeartbeatIntervals.set(baseUrl, null);
    }

    globalWebSockets.set(baseUrl, null);
    globalConnecting.set(baseUrl, false);

    // 상태 리스너들에게 알림
    getOrCreateStateListenerSet(baseUrl).forEach(listener => listener(false));

    // 비정상 종료시 재연결 (점진적 백오프: 3초 → 6초 → 12초 → 최대 30초)
    if (event.code !== 1000 && event.code !== 1005) {
      const existingTimeout = globalReconnectTimeouts.get(baseUrl);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const attempts = globalReconnectAttempts.get(baseUrl) || 0;
      const reconnectBaseDelay = 3000; // 3초 시작
      const maxDelay = 30000; // 최대 30초
      const delay = Math.min(reconnectBaseDelay * Math.pow(2, attempts), maxDelay);

      globalReconnectAttempts.set(baseUrl, attempts + 1);

      const timeout = setTimeout(() => {
        console.log(`[ClinicWS] 🔄 Reconnecting... (attempt ${attempts + 1}, delay ${delay}ms)`);
        connectGlobalWebSocket(baseUrl); // baseUrl로 재연결 (최신 토큰 자동 사용)
      }, delay);
      globalReconnectTimeouts.set(baseUrl, timeout);
    }
  };
}

function closeWebSocketIfUnused(url: string) {
  const baseUrl = getBaseUrl(url);
  const listeners = globalListeners.get(baseUrl);
  const stateListeners = globalStateListeners.get(baseUrl);
  const hasListeners = (listeners && listeners.size > 0) || (stateListeners && stateListeners.size > 0);
  if (hasListeners) {
    return;
  }

  const heartbeatInterval = globalHeartbeatIntervals.get(baseUrl);
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    globalHeartbeatIntervals.set(baseUrl, null);
  }

  const timeout = globalReconnectTimeouts.get(baseUrl);
  if (timeout) {
    clearTimeout(timeout);
    globalReconnectTimeouts.set(baseUrl, null);
  }

  const ws = globalWebSockets.get(baseUrl);
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close(1000);
  }
  globalWebSockets.set(baseUrl, null);
  globalConnecting.set(baseUrl, false);
  globalReconnectAttempts.set(baseUrl, 0);
}


export const useWebSocket = (url: string, options: UseWebSocketOptions = {}) => {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    enabled = true,
  } = options;

  // 기본 URL을 키로 사용 (토큰 제외)
  const baseUrl = getBaseUrl(url);

  const [isConnected, setIsConnected] = useState(false);
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

  // 메시지 리스너 등록
  useEffect(() => {
    if (!enabled) return;

    const messageHandler = (data: any) => {
      onMessageRef.current?.(data);
    };

    const stateHandler = (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        onOpenRef.current?.();
      } else {
        onCloseRef.current?.();
      }
    };

    getOrCreateListenerSet(baseUrl).add(messageHandler);
    getOrCreateStateListenerSet(baseUrl).add(stateHandler);

    // 연결 시작 (baseUrl 전달 - 최신 토큰 자동 사용)
    connectGlobalWebSocket(baseUrl);

    // 현재 연결 상태 확인
    const currentWs = globalWebSockets.get(baseUrl);
    if (currentWs && currentWs.readyState === WebSocket.OPEN) {
      setIsConnected(true);
    }

    // 페이지 언로드 시 WebSocket 정상 종료 (서버 부하 감소)
    const handleBeforeUnload = () => {
      const ws = globalWebSockets.get(baseUrl);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000);
      }
    };
    const handlePageHide = () => {
      const ws = globalWebSockets.get(baseUrl);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      getOrCreateListenerSet(baseUrl).delete(messageHandler);
      getOrCreateStateListenerSet(baseUrl).delete(stateHandler);
      closeWebSocketIfUnused(baseUrl);
      // 싱글톤이므로 연결은 끊지 않음
    };
  }, [baseUrl, enabled]);

  const sendMessage = useCallback((message: any) => {
    const ws = globalWebSockets.get(baseUrl);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    console.warn('[ClinicWS] Not connected');
    return false;
  }, [baseUrl]);

  const disconnect = useCallback(() => {
    // Heartbeat 정리
    const heartbeatInterval = globalHeartbeatIntervals.get(baseUrl);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      globalHeartbeatIntervals.set(baseUrl, null);
    }

    const timeout = globalReconnectTimeouts.get(baseUrl);
    if (timeout) {
      clearTimeout(timeout);
      globalReconnectTimeouts.set(baseUrl, null);
    }
    const ws = globalWebSockets.get(baseUrl);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000);
    }
    globalWebSockets.set(baseUrl, null);
    globalConnecting.set(baseUrl, false);
  }, [baseUrl]);

  const reconnect = useCallback(() => {
    connectGlobalWebSocket(baseUrl);
  }, [baseUrl]);

  return {
    sendMessage,
    disconnect,
    reconnect,
    isConnected,
  };
};
