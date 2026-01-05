import { useState, useCallback } from 'react';
import { getWaitingQueue } from '../api/administration_api';

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

  return {
    waitingQueueData,
    isLoading,
    error,
    fetchWaitingQueue,
    refetch: fetchWaitingQueue,
  };
};
