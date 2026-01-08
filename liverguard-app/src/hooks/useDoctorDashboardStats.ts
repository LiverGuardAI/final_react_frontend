import { useState, useCallback, useEffect } from 'react';
import { getDoctorDashboardStats, type DoctorDashboardStats } from '../api/doctorApi';

export const useDoctorDashboardStats = (doctorId: number | null) => {
  const [stats, setStats] = useState<DoctorDashboardStats>({
    total_patients: 0,
    clinic_waiting: 0,
    clinic_in_progress: 0,
    completed_today: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!doctorId) {
      setStats({
        total_patients: 0,
        clinic_waiting: 0,
        clinic_in_progress: 0,
        completed_today: 0,
      });
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getDoctorDashboardStats(doctorId);
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
  }, [doctorId]);

  // WebSocket 로직 제거됨 (Global Context에서 관리)

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
