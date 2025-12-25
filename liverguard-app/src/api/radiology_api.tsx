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

export interface StartFilmingRequest {
  patient_id: string;
}

export interface StartFilmingResponse {
  message: string;
  patient: Patient;
}

/**
 * 촬영 시작 - 환자 상태를 '촬영중'으로 변경
 * POST /api/radiology/waitlist/start-filming/
 */
export const startFilming = async (patientId: string): Promise<StartFilmingResponse> => {
  const response = await apiClient.post<StartFilmingResponse>(
    "radiology/waitlist/start-filming/",
    { patient_id: patientId }
  );
  return response.data;
};

export interface EndFilmingResponse {
  message: string;
  patient: Patient;
}

/**
 * 촬영 종료 - 환자 상태를 '촬영완료'로 변경
 * POST /api/radiology/waitlist/end-filming/
 */
export const endFilming = async (patientId: string): Promise<EndFilmingResponse> => {
  const response = await apiClient.post<EndFilmingResponse>(
    "radiology/waitlist/end-filming/",
    { patient_id: patientId }
  );
  return response.data;
};