import { useState, useCallback, useEffect } from 'react';
import { getDoctorWaitingQueue, type WaitingQueueResponse } from '../api/doctorApi';

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

  // WebSocket 로직 제거됨 (Global Context에서 관리)

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
