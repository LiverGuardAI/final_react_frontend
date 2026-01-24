// src/components/radiology/PatientQueueSidebar.tsx
import React, { useState, useEffect } from 'react';
import { getWaitlist, startFilming } from '../../api/radiology_api';
import type { Patient as APIPatient } from '../../api/radiology_api';
import { useWebSocketContext } from '../../context/WebSocketContext';
import './PatientQueueSidebar.css';

interface Patient {
  id: string;
  name: string;
  episode: string;
  status: '촬영중' | '촬영대기';
  gender?: string;
  age?: number | null;
  waitingMinutes?: number | null;
}

export interface SelectedPatientData {
  patientId: string;
  patientName: string;
  gender: string;
  birthDate: string;
  age: number | null;
  orderNotes?: string[];
  examType?: string;
  modality?: string;
  bodyPart?: string;
  studyInstanceUid?: string;
  encounterId?: number | string;
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
  const { lastMessage } = useWebSocketContext();
  const hasActiveFilming = patients.some((patient) => patient.status === '촬영중');
  const selectedApiPatient = selectedPatientId
    ? apiPatients.find((patient) => patient.patient_id === selectedPatientId)
    : undefined;
  const orderNotes = (selectedApiPatient?.imaging_orders || [])
    .map((order) => order?.order_notes)
    .filter((note) => typeof note === 'string' && note.trim().length > 0) as string[];

  const resolveStatus = (patient: APIPatient): Patient['status'] => {
    const orderStatuses = Array.isArray(patient.imaging_orders)
      ? patient.imaging_orders
          .map((order) => (typeof order?.status === 'string' ? order.status : ''))
          .filter((status) => status.length > 0)
      : [];
    if (orderStatuses.includes('IN_PROGRESS')) {
      return '촬영중';
    }
    if (orderStatuses.some((status) => status === 'WAITING' || status === 'REQUESTED')) {
      return '촬영대기';
    }
    if (patient.current_status === '촬영중') {
      return '촬영중';
    }
    if (patient.workflow_state === 'IN_IMAGING') {
      return '촬영중';
    }
    if (patient.workflow_state_display === '촬영중') {
      return '촬영중';
    }
    return '촬영대기';
  };

  const generateDicomUid = () => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      const uidInt = BigInt(`0x${hex}`);
      return `2.25.${uidInt.toString()}`;
    }
    return `2.25.${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  };

  const buildExamType = (orders: Array<Record<string, any>> | undefined) => {
    if (!Array.isArray(orders) || orders.length === 0) {
      return 'N/A';
    }
    const labels = orders
      .map((order) => {
        const modality = typeof order?.modality === 'string' ? order.modality.trim() : '';
        const bodyPart = typeof order?.body_part === 'string' ? order.body_part.trim() : '';
        if (modality && bodyPart && bodyPart !== 'N/A') {
          return `${modality} ${bodyPart}`;
        }
        if (modality) {
          return modality;
        }
        if (bodyPart && bodyPart !== 'N/A') {
          return bodyPart;
        }
        return '';
      })
      .filter((label) => label.length > 0);
    const uniqueLabels = Array.from(new Set(labels));
    return uniqueLabels.length > 0 ? uniqueLabels.join(' / ') : 'N/A';
  };

  const extractOrderMeta = (orders: Array<Record<string, any>> | undefined) => {
    if (!Array.isArray(orders)) {
      return { modality: undefined, bodyPart: undefined };
    }
    for (const order of orders) {
      const modality = typeof order?.modality === 'string' ? order.modality.trim() : '';
      const bodyPart = typeof order?.body_part === 'string' ? order.body_part.trim() : '';
      if (modality || bodyPart) {
        return {
          modality: modality || undefined,
          bodyPart: bodyPart && bodyPart !== 'N/A' ? bodyPart : undefined,
        };
      }
    }
    return { modality: undefined, bodyPart: undefined };
  };

  const formatGender = (value?: string | null) => {
    if (!value) return 'N/A';
    const normalized = value.toLowerCase();
    if (normalized === 'm' || normalized === 'male' || normalized === '남') return '남';
    if (normalized === 'f' || normalized === 'female' || normalized === '여') return '여';
    return value;
  };

  const fetchWaitlist = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getWaitlist();
        const hasValidList = Array.isArray(response?.patients) || Array.isArray((response as any)?.results);
        const responsePatients = Array.isArray(response?.patients)
          ? response.patients
          : Array.isArray((response as any)?.results)
            ? (response as any).results
            : [];
        if (!hasValidList) {
          console.warn('Unexpected waitlist response shape:', response);
          setPatients([]);
          setApiPatients([]);
          setError('환자 대기 목록을 불러오는데 실패했습니다.');
          return;
        }

        // API 응답을 컴포넌트 형식에 맞게 변환
        const mappedPatients: Patient[] = responsePatients.map((patient: APIPatient) => ({
          id: patient.patient_id,
          name: patient.patient_name || patient.name || 'N/A',
          episode: patient.encounter_id || patient.patient_id,
          status: resolveStatus(patient),
          gender: formatGender(patient.gender),
          age: patient.age ?? null,
          waitingMinutes: patient.waiting_minutes ?? null,
        }));

        setPatients(mappedPatients);
        setApiPatients(responsePatients);
      } catch (err) {
        console.error('Failed to fetch waitlist:', err);
        setError('환자 대기 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchWaitlist();
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type !== 'queue_update') return;
    const queueType = lastMessage.data?.queue_type;
    if (!queueType || queueType === 'imaging') {
      fetchWaitlist();
    }
  }, [lastMessage]);

  const handleStartExam = async (patientId: string) => {
    if (hasActiveFilming) {
      alert('이미 촬영중인 환자가 있습니다.');
      return;
    }
    const apiPatient = apiPatients.find(p => p.patient_id === patientId);
    if (apiPatient) {
      try {
        // 촬영 시작 API 호출 - 환자 상태를 '촬영중'으로 변경
        const studyUid = generateDicomUid();
        const response = await startFilming(patientId, studyUid);

        // 환자 정보 전달
        const patientData: SelectedPatientData = {
          patientId: apiPatient.patient_id,
          patientName: apiPatient.patient_name || apiPatient.name || 'N/A',
          gender: apiPatient.gender || 'N/A',
          birthDate: apiPatient.date_of_birth || 'N/A',
          age: apiPatient.age,
          orderNotes: (apiPatient.imaging_orders || [])
            .map((order) => order?.order_notes)
            .filter((note) => typeof note === 'string' && note.trim().length > 0) as string[],
          examType: buildExamType(apiPatient.imaging_orders as Array<Record<string, any>> | undefined),
          ...extractOrderMeta(apiPatient.imaging_orders as Array<Record<string, any>> | undefined),
          studyInstanceUid: response.study_uid || studyUid,
          encounterId: apiPatient.encounter_id ?? undefined,
        };
        onPatientSelect(patientId, patientData);

        // 대기 목록 새로고침
        const waitlistResponse = await getWaitlist();
        const hasValidList = Array.isArray(waitlistResponse?.patients) || Array.isArray((waitlistResponse as any)?.results);
        const responsePatients = Array.isArray(waitlistResponse?.patients)
          ? waitlistResponse.patients
          : Array.isArray((waitlistResponse as any)?.results)
            ? (waitlistResponse as any).results
            : [];
        if (!hasValidList) {
          console.warn('Unexpected waitlist response shape:', waitlistResponse);
          setPatients([]);
          setApiPatients([]);
          setError('환자 대기 목록을 불러오는데 실패했습니다.');
          return;
        }
        const mappedPatients: Patient[] = responsePatients.map((patient: APIPatient) => ({
          id: patient.patient_id,
          name: patient.patient_name || patient.name || 'N/A',
          episode: patient.encounter_id || patient.patient_id,
          status: resolveStatus(patient),
          gender: formatGender(patient.gender),
          age: patient.age ?? null,
          waitingMinutes: patient.waiting_minutes ?? null,
        }));
        setPatients(mappedPatients);
        setApiPatients(responsePatients);
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
              <div className="patient-demographics">
                <span>
                  {patient.age !== null && patient.age !== undefined ? `${patient.age}세` : 'N/A'} /{' '}
                  {patient.gender || 'N/A'}
                </span>
              </div>
              <div className="patient-waiting-time">
                대기시간: {patient.waitingMinutes !== null && patient.waitingMinutes !== undefined
                  ? `${patient.waitingMinutes}분`
                  : 'N/A'}
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

      <div className="queue-order-notes">
        <div className="queue-order-notes-header">오더 노트</div>
        <div className="queue-order-notes-body">
          {selectedPatientId ? (
            orderNotes.length > 0 ? (
              orderNotes.map((note, index) => (
                <div key={`${selectedPatientId}-note-${index}`} className="order-note-item">
                  {note}
                </div>
              ))
            ) : (
              <div className="order-note-empty">오더 노트가 없습니다.</div>
            )
          ) : (
            <div className="order-note-empty">환자를 선택해주세요.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientQueueSidebar;
