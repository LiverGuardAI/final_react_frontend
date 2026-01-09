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
  patient_id: string;
  patient_name: string;
  doctor_name: string;
  department_name: string;
  created_at: string;
  status: string;
  status_display: string;
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


