// src/api/administrationApi.tsx
import apiClient from "./axiosConfig";

// 환자 등록 데이터 타입
export interface PatientRegistrationData {
  patient_id: string;
  name: string;
  date_of_birth: string;  // YYYY-MM-DD
  gender: "M" | "F";
  phone?: string;
}

// 환자 등록 API
export const registerPatient = async (data: PatientRegistrationData) => {
  const response = await apiClient.post("administration/patients/register/", data);
  return response.data;
};

export interface PendingOrder {
  id: string;
  type: 'LAB' | 'IMAGING';
  type_display: string;
  order_name: string;
  order_type?: string; // LAB 오더의 세부 타입 (GENOMIC, BLOOD_LIVER, VITAL, PHYSICAL)
  patient_id: string;
  patient_name: string;
  doctor_name: string;
  department_name: string;
  created_at: string;
  status: string;
  status_display: string;
  encounter_id?: number;
}

export const getPendingOrders = async (): Promise<{ count: number; results: PendingOrder[] }> => {
  const response = await apiClient.get('/administration/orders/pending/');
  return response.data;
};

// 환자 목록 조회 API
export const getPatientList = async (search?: string, page: number = 1, pageSize: number = 20) => {
  const params: any = { page, page_size: pageSize };
  if (search) {
    params.search = search;
  }
  const response = await apiClient.get("administration/patients/", { params });
  return response.data;
};

// 환자 상세 조회 API
export const getPatientDetail = async (patientId: string) => {
  const response = await apiClient.get(`administration/patients/${patientId}/`);
  return response.data;
};

// 환자 정보 수정 API
export interface PatientUpdateData {
  name?: string;
  date_of_birth?: string;
  gender?: "M" | "F";
  phone?: string;
}

export const updatePatient = async (patientId: string, data: PatientUpdateData) => {
  const response = await apiClient.patch(`administration/patients/${patientId}/`, data);
  return response.data;
};

// ===========================
// 오더 처리 API
// ===========================

export const confirmOrder = async (
  orderId: number | string,
  type: 'LAB' | 'IMAGING',
  action: 'CONFIRM' | 'CONFIRM_AND_DISCHARGE' = 'CONFIRM'
) => {
  // ID prefix 제거 (lab_1 -> 1)
  const numericId = typeof orderId === 'string' ? orderId.split('_')[1] : orderId;

  const response = await apiClient.patch(`/administration/orders/${numericId}/confirm/`, {
    order_type: type,
    action
  });
  return response.data;
};

// 영상의학과 오더에 의사 배정 API
export const assignDoctorToImagingOrder = async (
  orderId: number | string,
  doctorId: number
) => {
  const numericId = typeof orderId === 'string' ? orderId.split('_')[1] : orderId;

  const response = await apiClient.patch(`/administration/orders/${numericId}/assign-doctor/`, {
    doctor_id: doctorId,
    order_type: 'IMAGING'
  });
  return response.data;
};

// 바이탈/신체계측 데이터 제출 API
export interface VitalOrPhysicalSubmitData {
  // 바이탈 데이터
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  body_temperature?: number;
  respiratory_rate?: number;

  // 신체계측 데이터
  height?: number;
  weight?: number;
  bmi?: number;
}

export const submitVitalOrPhysicalData = async (
  orderId: number | string,
  orderType: 'VITAL' | 'PHYSICAL',
  data: VitalOrPhysicalSubmitData
) => {
  const numericId = typeof orderId === 'string' ? orderId.split('_')[1] : orderId;

  const response = await apiClient.patch(`/administration/orders/${numericId}/complete-vital/`, {
    order_type: orderType,
    lab_data: data
  });
  return response.data;
};

// Encounter 업데이트 API
export const updateEncounter = async (encounterId: number, data: { workflow_state?: string }) => {
  const response = await apiClient.patch(`/administration/encounters/${encounterId}/`, data);
  return response.data;
};

