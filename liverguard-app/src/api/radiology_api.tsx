// src/api/radiology_api.tsx
import apiClient from "./axiosConfig";

// 타입 정의
export interface Patient {
  patient_id: string;
  sample_id: string | null;
  name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  current_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistResponse {
  message: string;
  count: number;
  patients: Patient[];
}

/**
 * 촬영 대기 환자 목록 조회
 * GET /api/radiology/waitlist/
 */
export const getWaitlist = async (): Promise<WaitlistResponse> => {
  const response = await apiClient.get<WaitlistResponse>("radiology/waitlist/");
  return response.data;
};