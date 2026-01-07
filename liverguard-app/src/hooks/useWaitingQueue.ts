import { useState, useCallback, useEffect } from 'react';
import { getWaitingQueue } from '../api/administration_api';
import { useWebSocket } from './useWebSocket';

interface QueueItem {
  encounter_id: number;
  patient_name: string;
  patient_id: string;
  queued_at?: string;
  priority?: number;
  doctor_name?: string;
  room_number?: string;
}

interface WaitingQueueData {
  queue: QueueItem[];
  total_waiting: number;
}

export const useWaitingQueue = () => {
  const [waitingQueueData, setWaitingQueueData] = useState<WaitingQueueData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWaitingQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWaitingQueue(50);
      setWaitingQueueData(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || '대기열 조회 실패';
      setError(errorMessage);
      console.error('대기열 조회 실패:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket으로 실시간 업데이트 수신 (원무과용)
  const wsUrl = `ws://${window.location.hostname}:8000/ws/clinic/`;
  useWebSocket(wsUrl, {
    onMessage: (data) => {
      console.log('📩 WebSocket 메시지 수신 (원무과):', data);
      // 대기열 변경 시 자동 refetch (type은 'queue_update'임!)
      if (data.type === 'queue_update') {
        console.log('🔄 대기열 업데이트 감지 - refetch 시작');
        fetchWaitingQueue();
      }
    },
    onOpen: () => {
      console.log('✅ WebSocket 연결 (원무과 대기열)');
    },
  });

  // 초기 로드
  useEffect(() => {
    fetchWaitingQueue();
  }, [fetchWaitingQueue]);

  return {
    waitingQueueData,
    isLoading,
    error,
    fetchWaitingQueue,
    refetch: fetchWaitingQueue,
  };
};
