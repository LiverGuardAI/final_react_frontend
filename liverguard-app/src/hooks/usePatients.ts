import { useState, useCallback } from 'react';
import { getPatientList } from '../api/administrationApi';

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  phone: string;
  emergencyContact: string;
  address: string;
  registrationDate: string;
  lastVisit?: string;
}

export const usePatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPatients = useCallback(async (searchQuery: string = '', page: number = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getPatientList(searchQuery);

      const formattedPatients: Patient[] = response.results.map((p: any) => {
        const hasAppProfile = Boolean(p.profile);
        return {
          id: p.patient_id,
          name: p.name,
          birthDate: p.date_of_birth || 'N/A',
          age: p.age || 0,
          gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : 'N/A',
          phone: p.phone || 'N/A',
          emergencyContact: 'N/A',
          address: 'N/A',
          registrationDate: p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : 'N/A',
          lastVisit: hasAppProfile ? 'N/A' : (p.updated_at ? new Date(p.updated_at).toLocaleDateString('ko-KR') : 'N/A'),
        };
      });

      setPatients(formattedPatients);
      setCurrentPage(page);
      setTotalPages(Math.ceil(response.count / 20) || 1);

      return formattedPatients;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || '환자 목록 조회 실패';
      setError(errorMessage);
      console.error('환자 목록 조회 실패:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    patients,
    isLoading,
    error,
    currentPage,
    totalPages,
    fetchPatients,
    setCurrentPage,
  };
};
