// src/api/administration_api.ts
import apiClient from "./axiosConfig";

// ==================== 대시보드 ====================
export const getAdministrationDashboard = async () => {
  const res = await apiClient.get("administration/dashboard/");
  return res.data;
};

// ==================== 환자 관리 ====================
export const getPatients = async (search?: string) => {
  const params = search ? { search } : {};
  const res = await apiClient.get("administration/patients/", { params });
  return res.data;
};

export const getPatientDetail = async (patientId: string) => {
  const res = await apiClient.get(`administration/patients/${patientId}/`);
  return res.data;
};

export const registerPatient = async (patientData: {
  patient_id: string;
  name: string;
  date_of_birth?: string;
  age?: number;
  gender?: "M" | "F";
  doctor_id?: number;
}) => {
  const res = await apiClient.post("administration/patients/register/", patientData);
  return res.data;
};

// ==================== 예약 관리 ====================
export const getAppointments = async (filters?: {
  status?: string;
  date?: string;
  patient_id?: string;
}) => {
  const res = await apiClient.get("administration/appointments/", { params: filters });
  return res.data;
};

export const getAppointmentDetail = async (appointmentId: number) => {
  const res = await apiClient.get(`administration/appointments/${appointmentId}/`);
  return res.data;
};

export const createAppointment = async (appointmentData: {
  appointment_date: string;
  appointment_time: string;
  appointment_type?: string;
  status?: string;
  department?: string;
  notes?: string;
  patient: string;
  doctor?: number;
  staff?: number;
}) => {
  const res = await apiClient.post("administration/appointments/", appointmentData);
  return res.data;
};

export const updateAppointment = async (appointmentId: number, appointmentData: Partial<{
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  status: string;
  department: string;
  notes: string;
  doctor: number;
}>) => {
  const res = await apiClient.put(`administration/appointments/${appointmentId}/`, appointmentData);
  return res.data;
};

export const deleteAppointment = async (appointmentId: number) => {
  const res = await apiClient.delete(`administration/appointments/${appointmentId}/`);
  return res.data;
};

// ==================== 진료 기록 (접수) ====================
export const getEncounters = async (patientId?: string) => {
  const params = patientId ? { patient_id: patientId } : {};
  const res = await apiClient.get("administration/encounters/", { params });
  return res.data;
};

export const getEncounterDetail = async (encounterId: number) => {
  const res = await apiClient.get(`administration/encounters/${encounterId}/`);
  return res.data;
};

export const createEncounter = async (encounterData: {
  encounter_date: string;
  encounter_time: string;
  encounter_status?: string;
  department?: string;
  clinic_room?: string;
  is_first_visit?: boolean;
  chief_complaint?: string;
  patient: string;
  doctor: number;
  staff?: number;
  priority?: number;
  workflow_state?: string;
}) => {
  const res = await apiClient.post("administration/encounters/", encounterData);
  return res.data;
};

export const cancelEncounter = async (encounterId: number) => {
  const res = await apiClient.patch(`administration/encounters/${encounterId}/`, {
    workflow_state: 'CANCELLED'
  });
  return res.data;
};

export const updateEncounter = async (encounterId: number, data: { chief_complaint?: string;[key: string]: any }) => {
  const res = await apiClient.patch(`administration/encounters/${encounterId}/`, data);
  return res.data;
};

// ==================== 의사 관리 ====================
export const getAvailableDoctors = async () => {
  const res = await apiClient.get("doctor/list/");
  return res.data;
};

// ==================== 대기열 관리 ====================
export const getWaitingQueue = async (maxCount: number = 10) => {
  const res = await apiClient.get("administration/queue/waiting/", { params: { max_count: maxCount } });
  return res.data;
};

export const getDashboardStats = async () => {
  const res = await apiClient.get("administration/dashboard/stats/");
  return res.data;
};

// ==================== 문진표 관리 ====================
export const createQuestionnaire = async (questionnaireData: any) => {
  // 임시: chief_complaint에 JSON 문자열로 저장
  const questionnaireJson = JSON.stringify(questionnaireData);

  const encounterData = {
    patient: questionnaireData.patient_id,
    doctor: questionnaireData.doctor || 1, // 기본값 (나중에 수정)
    encounter_date: new Date().toISOString().split('T')[0],
    encounter_time: new Date().toTimeString().split(' ')[0].substring(0, 8),
    chief_complaint: questionnaireJson,
    is_first_visit: false,
    department: '소화기내과',
    priority: 5,
  };

  const res = await apiClient.post("administration/encounters/", encounterData);
  return res.data;
};
