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
  const response = await apiClient.get('/doctor/queue/', {
    params: {
      doctor_id: doctorId,
      status: 'ALL', // Fetch Waiting, InProgress, and Completed (including Waiting Results)
      limit,
    },
  });

  return {
    queue: response.data.encounters,
    total_waiting: response.data.stats?.waiting || 0
  };
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
  const response = await apiClient.get('/doctor/dashboard/');
  return response.data.stats;
};

/**
 * 특정 의사의 진행중인 Encounter 조회
 * @param doctorId - 의사 ID
 */
export const getDoctorInProgressEncounter = async (
  doctorId: number
): Promise<QueueItem | null> => {
  const response = await apiClient.get('/doctor/queue/', {
    params: {
      doctor_id: doctorId,
      status: 'IN_CLINIC',
    },
  });
  const queue = response.data.encounters || [];
  const matchesDoctor = (item: any) => {
    if (!doctorId) return true;
    const ids = [
      item.assigned_doctor,
      item.assigned_doctor_id,
      item.doctor_id,
      item.doctor,
    ];
    return ids.some((id) => Number(id) === doctorId);
  };
  const inProgressEncounter = queue.find(
    (item: any) => item.workflow_state === 'IN_CLINIC' && matchesDoctor(item)
  );
  return inProgressEncounter || null;
};

// ===========================
// Encounter 관련 API
// ===========================

export interface EncounterUpdateData {
  workflow_state?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'IN_CLINIC' | 'WAITING_RESULTS' | 'WAITING_PAYMENT';
  status?: string; // Backward compatibility
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
  encounter_date?: string;
  encounter_time?: string;
  record_date?: string;
  record_time?: string;
  encounter_start?: string;
  encounter_end?: string;
  chief_complaint?: string;
  clinical_notes?: string;
  diagnosis_name?: string;
  next_visit_date?: string;
  lab_recorded?: boolean;
  ct_recorded?: boolean;
  questionnaire?: {
    questionnaire_id: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    status_display: string;
    data: any;
    created_at: string;
    updated_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface SaveMedicalRecordPayload {
  encounter_id: number;
  patient_id: string;
  chief_complaint?: string;
  clinical_notes?: string;
  record_status?: 'DRAFT' | 'COMPLETED' | 'AMENDED';

  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    days: string;
  }>;
}

export interface QuestionnaireRecord {
  questionnaire_id: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  status_display: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface VitalRecord {
  vital_id: number;
  measured_at: string;
  sbp?: number | null;
  dbp?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heartRate?: number | null;
  body_temperature?: number | null;
  patient?: string;
  medical_record?: number | null;
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
 * 진료 기록 임시 저장
 */
export const saveMedicalRecord = async (
  payload: SaveMedicalRecordPayload
): Promise<EncounterDetail> => {
  const response = await apiClient.post('/doctor/medical-records/save/', payload);
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

/**
 * 특정 환자의 문진표 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수 (선택)
 */
export const getPatientQuestionnaires = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: QuestionnaireRecord[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/questionnaires/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

/**
 * 특정 환자의 바이탈 기록 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수 (선택)
 */
export const getPatientVitals = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: VitalRecord[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/vitals/`, {
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

export interface PatientProfile {
  patient_id: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  measured_at?: string | null;
}

export const getPatientProfile = async (patientId: string): Promise<PatientProfile> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/profile/`);
  return response.data;
};

/**
 * 특정 환자의 혈액 검사 결과 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수 (선택)
 */

export interface LabOrder {
  order_id: number;
  patient_name: string;
  doctor_name: string;
  order_type: string;
  order_type_display: string;
  status: string;
  status_display: string;
  order_notes: any;
  created_at: string;
  encounter?: number;
}

/**
 * 특정 환자의 진단검사(Lab) 오더 목록 조회
 * @param patientId - 환자 ID
 * @param limit - 조회할 최대 건수
 */
export const getPatientLabOrders = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: LabOrder[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/lab-orders/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

export const getPatientLabResults = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: LabResult[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/lab-results/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

export interface CreateLabResultPayload {
  test_date: string;
  measured_at?: string | null;
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
}

export const createLabResult = async (
  patientId: string,
  payload: CreateLabResultPayload
): Promise<LabResult> => {
  const response = await apiClient.post(`/lis/patient/${patientId}/lab-results/`, payload);
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
  encounter?: number;
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
  const response = await apiClient.get(`/doctor/patient/${patientId}/doctor-to-radiology-orders/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

export interface HCCDiagnosis {
  hcc_id: number;
  patient_name: string;
  hcc_diagnosis_date: string;
  measured_at?: string | null;
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

export interface CtSeriesItem {
  series_uid: string;
  study_id: string;
  series_description?: string;
  series_number?: number;
  modality?: string;
  study__study_datetime?: string;
  study__body_part?: string;
  acquisition_datetime?: string;
  image_count?: number;
  slice_thickness?: number | string;
  pixel_spacing?: string;
  protocol_name?: string;
}

export const getPatientCtSeries = async (
  patientId: string
): Promise<{ count: number; results: CtSeriesItem[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/ct-series/`);
  return response.data;
};

export interface GenomicDataItem {
  genomic_id: number;
  sample_date?: string;
  created_at?: string;
  measured_at?: string | null;
  patient?: string;
  pathway_scores?: Record<string, number> | null;
}


export const getPatientGenomicData = async (
  patientId: string,
  limit?: number
): Promise<{ count: number; results: GenomicDataItem[] }> => {
  const response = await apiClient.get(`/doctor/patient/${patientId}/genomic-data/`, {
    params: limit ? { limit } : {},
  });
  return response.data;
};

export interface CreateGenomicDataPayload {
  sample_date: string;
  measured_at?: string | null;
  pathway_scores?: Record<string, number>;
}

export const createGenomicData = async (
  patientId: string,
  payload: CreateGenomicDataPayload
): Promise<GenomicDataItem> => {
  const response = await apiClient.post(`/lis/patient/${patientId}/genomic-data/`, payload);
  return response.data;
};

export default apiClient;

/**
 * 의사 본인의 진료 기록 목록 조회
 * @param params - 검색 조건 (search, startDate, endDate)
 */
export const getDoctorMedicalRecords = async (params: {
  search?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ count: number; results: EncounterDetail[] }> => {
  const response = await apiClient.get('/doctor/medical-records/', {
    params,
  });
  return response.data;
};

// ===========================
// 공지사항 API
// ===========================

export interface AnnouncementItem {
  announcement_id: number;
  title: string;
  content: string;
  announcement_type: 'GENERAL' | 'URGENT' | 'EVENT' | 'MAINTENANCE';
  announcement_type_display?: string;
  is_important: boolean;
  published_at?: string | null;
  created_at?: string;
  expires_at?: string | null;
  author_name?: string | null;
}

export const getAnnouncements = async (params?: {
  limit?: number;
  type?: AnnouncementItem['announcement_type'];
  important_only?: boolean;
}): Promise<{ count: number; results: AnnouncementItem[] }> => {
  const response = await apiClient.get('/doctor/announcements/', {
    params,
  });
  return response.data;
};

// ===========================
// 오더 생성 API
// ===========================

export interface CreateLabOrderRequest {
  patient_id: string;
  encounter_id: number;
  doctor_id: number;
  order_type: 'BLOOD_LIVER' | 'GENOMIC' | 'PHYSICAL' | 'VITAL';
  order_notes?: any; // JSON
}

export const createLabOrder = async (data: CreateLabOrderRequest) => {
  const response = await apiClient.post('/doctor/lab-orders/', data);
  return response.data;
};

export interface CreateImagingOrderRequest {
  patient_id: string;
  encounter_id: number;
  doctor_id: number;
  modality: string;
  body_part?: string;
  order_notes?: string;
}

export const createImagingOrder = async (data: CreateImagingOrderRequest) => {
  const response = await apiClient.post('/doctor/doctor-to-radiology-orders/', data);
  return response.data;
};
