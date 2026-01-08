import { useState, useCallback, useEffect } from 'react';
import { getDoctorWaitingQueue, type WaitingQueueResponse } from '../api/doctorApi';
import { useWebSocket } from './useWebSocket';

export const useDoctorWaitingQueue = (doctorId: number | null) => {
  const [waitingQueueData, setWaitingQueueData] = useState<WaitingQueueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWaitingQueue = useCallback(async () => {
    if (!doctorId) {
      setWaitingQueueData(null);
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getDoctorWaitingQueue(doctorId, 50);
      setWaitingQueueData(data);
      return data;
    } catch (err: any) {
  const errorMessage = err.response?.data?.message || '대기열 조회 실패';
      setError(errorMessage);
      console.error('대기열 조회 실패:', err, err.response?.data);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  // WebSocket으로 실시간 업데이트 수신
  const wsUrl = `ws://${window.location.hostname}:8000/ws/clinic/`;
  useWebSocket(wsUrl, {
    enabled: !!doctorId,
    onMessage: (data) => {
      console.log('📩 WebSocket 메시지 수신 (의사):', data);
      // 대기열 변경 시 자동 refetch (type은 'queue_update'임!)
      if (data.type === 'queue_update') {
        console.log('🔄 대기열 업데이트 감지 - refetch 시작');
        fetchWaitingQueue();
      }
    },
    onOpen: () => {
      console.log('✅ WebSocket 연결 (의사 대기열)');
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
