// axiosConfig를 사용하여 토큰 갱신 로직 중복 제거
import apiClient from './axiosConfig';

// ===========================
// 대기열 관련 API
// ===========================

export interface QueueItem {
  encounter_id: number;
  patient_name: string;
  patient_id: string;
  patient?: string;
  queued_at?: string;
  created_at?: string;
  updated_at?: string;
  priority?: number;
  doctor_name?: string;
  doctor_id?: number;
  doctor?: number;
  room_number?: string;
  encounter_status?: string;
  questionnaire_status?: string;
  questionnaire_status_display?: string;
  questionnaire_data?: any;
  date_of_birth?: string;
  gender?: string;
  age?: number;
  phone?: string;
  chief_complaint?: string;
  diagnosis?: string;
}

export interface WaitingQueueResponse {
  queue: QueueItem[];
  total_waiting: number;
}

/**
 * 특정 의사의 대기열 조회
 * @param doctorId - 의사 ID
 * @param limit - 조회할 최대 건수 (기본값: 50)
 */
export const getDoctorWaitingQueue = async (
  doctorId: number,
  limit: number = 50
): Promise<WaitingQueueResponse> => {
  const response = await apiClient.get('/administration/queue/', {
    params: {
      doctor_id: doctorId,
      limit,
    },
  });
  return response.data;
};

// ===========================
// 통계 관련 API
// ===========================

export interface DoctorDashboardStats {
  total_patients: number;
  clinic_waiting: number;
  clinic_in_progress: number;
  completed_today: number;
}

/**
 * 특정 의사의 대시보드 통계 조회
 * @param doctorId - 의사 ID
 */
export const getDoctorDashboardStats = async (
  doctorId: number
): Promise<DoctorDashboardStats> => {
  const response = await apiClient.get('/administration/dashboard/stats/', {
    params: {
      doctor_id: doctorId,
    },
  });
  return response.data;
};

/**
 * 특정 의사의 진행중인 Encounter 조회
 * @param doctorId - 의사 ID
 */
export const getDoctorInProgressEncounter = async (
  doctorId: number
): Promise<QueueItem | null> => {
  const response = await getDoctorWaitingQueue(doctorId, 50);
  const inProgressEncounter = response.queue.find(
    (item) => item.encounter_status === 'IN_PROGRESS'
  );
  return inProgressEncounter || null;
};

// ===========================
// Encounter 관련 API
// ===========================

export interface EncounterUpdateData {
  encounter_status?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  questionnaire_data?: any;
  questionnaire_status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  chief_complaint?: string;
  diagnosis?: string;
  treatment_plan?: string;
  notes?: string;
}

/**
 * Encounter 상태 업데이트 (진료 시작, 완료 등)
 * @param encounterId - Encounter ID
 * @param data - 업데이트할 데이터
 */
export const updateEncounter = async (
  encounterId: number,
  data: EncounterUpdateData
): Promise<any> => {
  const response = await apiClient.patch(`/administration/encounters/${encounterId}/`, data);
  return response.data;
};

/**
 * Encounter 취소
 * @param encounterId - Encounter ID
 */
export const cancelEncounter = async (encounterId: number): Promise<any> => {
  const response = await apiClient.post(`/administration/encounters/${encounterId}/cancel/`);
  return response.data;
};

// ===========================
// 환자 관련 API
// ===========================

export interface PatientDetail {
  patient_id: string;
  name: string;
  date_of_birth: string;
  gender: 'M' | 'F';
  age?: number;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  sample_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 환자 상세 정보 조회
 * @param patientId - 환자 ID
 */
export const getPatientDetail = async (patientId: string): Promise<PatientDetail> => {
  const response = await apiClient.get(`/administration/patients/${patientId}/`);
  return response.data;
};

// ===========================
// 의사 정보 관련 API
// ===========================

export interface DoctorInfo {
  doctor_id: number;
  name: string;
  department: {
    dept_id: number;
    dept_name: string;
  };
  room_number?: string;
  phone?: string;
  email?: string;
}

/**
 * 현재 로그인한 의사 정보 조회
 */
export const getCurrentDoctorInfo = async (): Promise<DoctorInfo> => {
  const response = await apiClient.get('/doctor/me/');
  return response.data;
};

// ===========================
// Encounter 상세 정보 관련 API
// ===========================

export interface EncounterDetail {
  encounter_id: number;
  patient: PatientDetail;
  doctor_name: string;
  staff_name: string;
  encounter_status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SCHEDULED' | 'NO_SHOW';
  encounter_status_display: string;
  questionnaire_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  questionnaire_status_display: string;
  questionnaire_data?: any;
  clinic_room?: string;
  encounter_date: string;
  encounter_time: string;
  encounter_start?: string;
  encounter_end?: string;
  chief_complaint?: string;
  clinical_notes?: string;
  diagnosis_name?: string;
  next_visit_date?: string;
  lab_recorded?: boolean;
  ct_recorded?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Encounter 상세 정보 조회
 * @param encounterId - Encounter ID
 */
export const getEncounterDetail = async (encounterId: number): Promise<EncounterDetail> => {
  const response = await apiClient.get(`/doctor/encounter/${encounterId}/`);
  return response.data;
};

/**
 * 특정 환자의 과거 진료 기록 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수 (선택)
 */
export const getPatientEncounterHistory = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: EncounterDetail[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/encounters/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

// ===========================
// 검사 결과 관련 API
// ===========================

export interface LabResult {
  lab_id: number;
  patient_name: string;
  test_date: string;
  afp?: number;
  albumin?: number;
  bilirubin_total?: number;
  pt_inr?: number;
  platelet?: number;
  creatinine?: number;
  child_pugh_class?: string;
  meld_score?: number;
  albi_score?: number;
  albi_grade?: string;
  created_at: string;
  measured_at?: string;
}

/**
 * 특정 환자의 혈액 검사 결과 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수 (선택)
 */
export const getPatientLabResults = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: LabResult[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/lab-results/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

export interface ImagingOrder {
  order_id: number;
  patient_name: string;
  doctor_name: string;
  modality: string;
  body_part?: string;
  status: string;
  status_display: string;
  ordered_at: string;
  scheduled_at?: string;
  study_uid?: string;
}

/**
 * 특정 환자의 영상 검사 오더 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수 (선택)
 */
export const getPatientImagingOrders = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: ImagingOrder[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/imaging-orders/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

export interface HCCDiagnosis {
  hcc_id: number;
  patient_name: string;
  hcc_diagnosis_date: string;
  ajcc_stage?: string;
  ajcc_t?: string;
  ajcc_n?: string;
  ajcc_m?: string;
  grade?: string;
  vascular_invasion?: string;
  ishak_score?: number;
  hepatic_inflammation?: string;
  ecog_score?: number;
  tumor_status?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 특정 환자의 HCC 진단 정보 조회
 * @param patientId - 환자 ID
 */
export const getPatientHCCDiagnosis = async (
  patientId: string
): Promise<{ count: number; results: HCCDiagnosis[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/hcc-diagnosis/`);
  return response.data;
};

export default apiClient;
