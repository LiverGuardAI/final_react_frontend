// src/api/radiology_api.tsx
import apiClient from "./axiosConfig";

// 타입 정의
export interface Patient {
  patient_id: string;
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

export interface TumorAnalysisResponse {
  success: boolean;
  mask_series_id: string;
  spacing_mm: {
    x: number;
    y: number;
    z: number;
  };
  analysis: {
    tumor_count: number;
    total_tumor_volume_mm3: number;
    total_tumor_volume_ml: number;
    liver_volume_mm3?: number | null;
    tumor_to_liver_ratio?: number | null;
    tumor_burden_percent?: number | null;
    components: Array<{
      label: number;
      voxel_count: number;
      volume_mm3: number;
      volume_ml: number;
      centroid_voxel: { z: number; y: number; x: number };
      centroid_mm: { z: number; y: number; x: number };
      max_diameter_mm: number;
      distance_to_liver_capsule_mm?: number | null;
    }>;
  };
  warnings?: string[];
}

/**
 * 종양 분석 요청
 * POST /api/radiology/tumor-analysis/
 */
export const analyzeTumor = async (maskSeriesId: string): Promise<TumorAnalysisResponse> => {
  const response = await apiClient.post<TumorAnalysisResponse>(
    "radiology/tumor-analysis/",
    { mask_series_id: maskSeriesId }
  );
  return response.data;
};

export interface CTReportResponse {
  report_id: number;
  series_instance_uid: string;
  report_text: string;
  created_at: string;
  updated_at: string;
}

/**
 * CT 보고서 저장
 * POST /api/radiology/ct-reports/
 */
export const saveCtReport = async (
  seriesInstanceUid: string,
  reportText: string
): Promise<CTReportResponse> => {
  const response = await apiClient.post<CTReportResponse>("radiology/ct-reports/", {
    series_instance_uid: seriesInstanceUid,
    report_text: reportText
  });
  return response.data;
};
