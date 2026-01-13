import { useState, useCallback, useEffect } from 'react';
import { getDashboardStats } from '../api/receptionApi';

interface DashboardStats {
  total_patients: number;
  clinic_waiting: number;
  clinic_in_progress: number;
  imaging_waiting: number;
  imaging_in_progress: number;
  completed_today: number;
}

export const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    total_patients: 0,
    clinic_waiting: 0,
    clinic_in_progress: 0,
    imaging_waiting: 0,
    imaging_in_progress: 0,
    completed_today: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || '통계 조회 실패';
      setError(errorMessage);
      console.error('통계 조회 실패:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket logic removed to prevent duplication. managed in AdministrationContext.

  // 초기 로드
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    fetchStats,
    refetch: fetchStats,
  };
};
