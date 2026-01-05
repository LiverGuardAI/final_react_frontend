// src/api/administrationApi.tsx
import apiClient from "./axiosConfig";

// 환자 등록 데이터 타입
export interface PatientRegistrationData {
  patient_id: string;
  name: string;
  date_of_birth: string;  // YYYY-MM-DD
  gender: "M" | "F";
  phone?: string;
  sample_id?: string;
}

// 환자 등록 API
export const registerPatient = async (data: PatientRegistrationData) => {
  const response = await apiClient.post("administration/patients/register/", data);
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
  sample_id?: string;
}

export const updatePatient = async (patientId: string, data: PatientUpdateData) => {
  const response = await apiClient.patch(`administration/patients/${patientId}/`, data);
  return response.data;
};
