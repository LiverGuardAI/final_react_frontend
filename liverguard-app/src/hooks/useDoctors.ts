import { useState, useCallback } from 'react';
import { getAvailableDoctors } from '../api/administration_api';

export interface Doctor {
  doctor_id: number;
  name: string;
  department: {
    dept_name: string;
  };
  room_number?: string;
}

export const useDoctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAvailableDoctors();
      const doctorList = data.results || data;
      setDoctors(doctorList);
      return doctorList;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || '의사 목록 조회 실패';
      setError(errorMessage);
      console.error('의사 목록 조회 실패:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    doctors,
    isLoading,
    error,
    fetchDoctors,
    refetch: fetchDoctors,
  };
};
