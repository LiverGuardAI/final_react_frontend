// src/components/radiology/PatientQueueSidebar.tsx
import React, { useState, useEffect } from 'react';
import { getWaitlist, startFilming } from '../../api/radiology_api';
import type { Patient as APIPatient } from '../../api/radiology_api';
import './PatientQueueSidebar.css';

interface Patient {
  id: string;
  name: string;
  episode: string;
  status: '촬영중' | '촬영대기';
}

export interface SelectedPatientData {
  patientId: string;
  patientName: string;
  gender: string;
  birthDate: string;
  age: number | null;
  sampleId: string | null;
}

interface PatientQueueSidebarProps {
  selectedPatientId?: string;
  onPatientSelect: (patientId: string, patientData: SelectedPatientData) => void;
}

const PatientQueueSidebar: React.FC<PatientQueueSidebarProps> = ({
  selectedPatientId,
  onPatientSelect,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [apiPatients, setApiPatients] = useState<APIPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasActiveFilming = patients.some((patient) => patient.status === '촬영중');

  useEffect(() => {
    const fetchWaitlist = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getWaitlist();

        // API 응답을 컴포넌트 형식에 맞게 변환
        const mappedPatients: Patient[] = response.patients.map((patient: APIPatient) => ({
          id: patient.patient_id,
          name: patient.name,
          episode: patient.sample_id || patient.patient_id,
          status: patient.current_status === '촬영중' ? '촬영중' : '촬영대기'
        }));

        setPatients(mappedPatients);
        setApiPatients(response.patients);
      } catch (err) {
        console.error('Failed to fetch waitlist:', err);
        setError('환자 대기 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchWaitlist();
  }, []);

  const handleStartExam = async (patientId: string) => {
    const apiPatient = apiPatients.find(p => p.patient_id === patientId);
    if (apiPatient) {
      try {
        // 촬영 시작 API 호출 - 환자 상태를 '촬영중'으로 변경
        await startFilming(patientId);

        // 환자 정보 전달
        const patientData: SelectedPatientData = {
          patientId: apiPatient.patient_id,
          patientName: apiPatient.name,
          gender: apiPatient.gender || 'N/A',
          birthDate: apiPatient.date_of_birth || 'N/A',
          age: apiPatient.age,
          sampleId: apiPatient.sample_id,
        };
        onPatientSelect(patientId, patientData);

        // 대기 목록 새로고침
        const response = await getWaitlist();
        const mappedPatients: Patient[] = response.patients.map((patient: APIPatient) => ({
          id: patient.patient_id,
          name: patient.name,
          episode: patient.sample_id || patient.patient_id,
          status: patient.current_status === '촬영중' ? '촬영중' : '촬영대기'
        }));
        setPatients(mappedPatients);
        setApiPatients(response.patients);
      } catch (err) {
        console.error('Failed to start filming:', err);
        setError('촬영을 시작하는데 실패했습니다.');
      }
    }
  };

  return (
    <div className="patient-queue-sidebar">
      <div className="sidebar-header">
        <h2>환자 대기열</h2>
      </div>

      <div className="patient-list">
        {loading && (
          <div className="empty-state">로딩 중...</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div className="empty-state">대기 중인 환자가 없습니다.</div>
        )}

        {!loading && !error && patients.map((patient) => (
          <div
            key={patient.id}
            className={`patient-card ${selectedPatientId === patient.id ? 'selected' : ''}`}
          >
            <div className="patient-card-header">
              <span className="patient-name">{patient.name}</span>
              <span className={`status-badge ${patient.status === '촬영중' ? 'active' : 'waiting'}`}>
                {patient.status}
              </span>
            </div>
            <div className="patient-card-body">
              <div className="patient-episode">
                EPISODE<br />
                {patient.episode}
              </div>
              {patient.status === '촬영대기' && (
                <button
                  className="start-exam-button"
                  onClick={() => handleStartExam(patient.id)}
                  disabled={hasActiveFilming}
                >
                  촬영 시작
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <h3>환자 정보</h3>
      </div>
    </div>
  );
};

export default PatientQueueSidebar;
