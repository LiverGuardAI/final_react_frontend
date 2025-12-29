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
  sample_id?: string;
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
  staff: number;
}) => {
  const res = await apiClient.post("administration/encounters/", encounterData);
  return res.data;
};
