// src/api/radiology_api.tsx
import apiClient from "./axiosConfig";

// 타입 정의
export interface Patient {
  encounter_id?: string;
  patient_id: string;
  name?: string;
  patient_name?: string;
  date_of_birth?: string | null;
  age?: number | null;
  gender?: string | null;
  current_status?: string | null;
  workflow_state?: string | null;
  workflow_state_display?: string | null;
  state_entered_at?: string | null;
  waiting_minutes?: number;
  doctor_name?: string | null;
  imaging_orders?: Array<Record<string, any>>;
  active_study_uid?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WaitlistResponse {
  success?: boolean;
  message: string;
  count: number;
  stats?: {
    waiting: number;
    in_progress: number;
  };
  patients: Patient[];
}

export interface EncounterStudyResponse {
  encounter_id: number;
  study_uid: string | null;
  patient_id: string;
  patient_name: string;
  gender: string | null;
  date_of_birth: string | null;
  age: number | null;
  order_notes?: string[];
}

/**
 * 촬영 대기 환자 목록 조회
 * GET /api/radiology/waitlist/
 */
export const getWaitlist = async (): Promise<WaitlistResponse> => {
  const response = await apiClient.get<WaitlistResponse>("radiology/waitlist/");
  return response.data;
};

/**
 * Encounter에 연결된 스터디 정보 조회
 * GET /api/radiology/encounters/{encounter_id}/study/
 */
export const getEncounterStudy = async (
  encounterId: number | string
): Promise<EncounterStudyResponse> => {
  const response = await apiClient.get<EncounterStudyResponse>(
    `radiology/encounters/${encounterId}/study/`
  );
  return response.data;
};

/**
 * DICOM 스터디에 속한 Series ID 목록 조회
 * GET /api/radiology/studies/{study_uid}/series/
 */
export const getDicomStudySeries = async (studyUid: string) => {
  const response = await apiClient.get<{ study_uid: string; series_ids: string[] }>(
    `radiology/studies/${studyUid}/series/`
  );
  return response.data;
};

export interface StartFilmingRequest {
  patient_id: string;
  study_uid?: string;
}

export interface StartFilmingResponse {
  message: string;
  patient: Patient;
  study_uid?: string;
}

/**
 * 촬영 시작 - 환자 상태를 '촬영중'으로 변경
 * POST /api/radiology/waitlist/start-filming/
 */
export const startFilming = async (
  patientId: string,
  studyUid?: string
): Promise<StartFilmingResponse> => {
  const payload: StartFilmingRequest = { patient_id: patientId };
  if (studyUid) {
    payload.study_uid = studyUid;
  }
  const response = await apiClient.post<StartFilmingResponse>(
    "radiology/waitlist/start-filming/",
    payload
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

export interface MaskClass {
  label_value: number;
  label_name: string;
  color?: string | null;
  is_present: boolean;
  is_custom: boolean;
}

export interface MaskClassResponse {
  success: boolean;
  mask_series_id: string;
  unique_values: number[];
  classes: MaskClass[];
  warnings?: string[];
}

/**
 * 마스크 클래스 목록 조회
 * GET /api/radiology/mask-classes/?mask_series_id=...
 */
export const getMaskClasses = async (maskSeriesId: string): Promise<MaskClassResponse> => {
  const response = await apiClient.get<MaskClassResponse>("radiology/mask-classes/", {
    params: { mask_series_id: maskSeriesId },
  });
  return response.data;
};

/**
 * 마스크 클래스 추가
 * POST /api/radiology/mask-classes/
 */
export const addMaskClass = async (
  maskSeriesId: string,
  labelName: string,
  labelValue?: number,
  color?: string | null
): Promise<{ success: boolean; class: MaskClass }> => {
  const payload: Record<string, any> = {
    mask_series_id: maskSeriesId,
    label_name: labelName,
  };
  if (labelValue !== undefined) {
    payload.label_value = labelValue;
  }
  if (color) {
    payload.color = color;
  }
  const response = await apiClient.post<{ success: boolean; class: MaskClass }>(
    "radiology/mask-classes/",
    payload
  );
  return response.data;
};

/**
 * 마스크 클래스 삭제
 * DELETE /api/radiology/mask-classes/?mask_series_id=...&label_value=...
 */
export const deleteMaskClass = async (
  maskSeriesId: string,
  labelValue: number
): Promise<{ success: boolean }> => {
  const response = await apiClient.delete<{ success: boolean }>("radiology/mask-classes/", {
    params: { mask_series_id: maskSeriesId, label_value: labelValue },
  });
  return response.data;
};

export interface MaskSaveSlice {
  slice_index: number;
  width: number;
  height: number;
  pixels: string;
}

export interface MaskSaveResponse {
  success: boolean;
  mask_series_id?: string;
  series_id?: string;
  series_instance_uid?: string;
}

/**
 * 수정된 마스크 저장 (전체 슬라이스 재생성)
 * POST /api/radiology/mask-save/
 */
export const saveMaskEdits = async (
  maskSeriesId: string,
  editedSlices: MaskSaveSlice[],
  overwrite = true
): Promise<MaskSaveResponse> => {
  const response = await apiClient.post<MaskSaveResponse>("radiology/mask-save/", {
    mask_series_id: maskSeriesId,
    edited_slices: editedSlices,
    overwrite,
  });
  return response.data;
};

export interface CTReportResponse {
  report_id: number;
  series_instance_uid: string;
  report_text: string;
  tumor_analysis?: TumorAnalysisResponse | null;
  created_at: string;
  updated_at: string;
}

/**
 * CT 보고서 목록 조회
 * GET /api/radiology/ct-reports/?series_instance_uid=...
 */
export const getCtReports = async (
  seriesInstanceUid: string
): Promise<CTReportResponse[]> => {
  const response = await apiClient.get<CTReportResponse[]>("radiology/ct-reports/", {
    params: { series_instance_uid: seriesInstanceUid }
  });
  return response.data;
};

/**
 * CT 보고서 저장
 * POST /api/radiology/ct-reports/
 */
export const saveCtReport = async (
  seriesInstanceUid: string,
  reportText: string,
  tumorAnalysis?: TumorAnalysisResponse | null
): Promise<CTReportResponse> => {
  const response = await apiClient.post<CTReportResponse>("radiology/ct-reports/", {
    series_instance_uid: seriesInstanceUid,
    report_text: reportText,
    tumor_analysis: tumorAnalysis ?? null
  });
  return response.data;
};
