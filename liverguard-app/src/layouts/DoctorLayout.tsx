import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import styles from './DoctorLayout.module.css';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useDoctorWaitingQueue } from '../hooks/useDoctorWaitingQueue';
import { useDoctorDashboardStats } from '../hooks/useDoctorDashboardStats';
import { updateEncounter } from '../api/doctorApi';
import DoctorPatientModal from '../components/doctor/DoctorPatientModal';
import DoctorSidebar from '../components/doctor/DoctorSidebar';
import DoctorTopBar from '../components/doctor/DoctorTopBar';
import { useTreatment } from '../contexts/TreatmentContext';
import { DoctorDataProvider } from '../contexts/DoctorDataContext';
import { mapWorkflowStateToStatus } from '../utils/encounterUtils';

interface Patient {
  encounterId: number;
  patientId: string;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  queuedAt?: string;
  phone?: string;
  questionnaireStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  questionnaireData?: any;
}

type TabType = 'home' | 'schedule' | 'treatment' | 'medicalRecord' | 'examination' | 'testForm' | 'medication';

export default function DoctorLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSelectedEncounterId, setSelectedPatientId, selectedPatientId } = useTreatment();

  // 현재 경로에서 activeTab 유추
  const activeTab: TabType = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/home')) return 'home';
    if (path.includes('/schedule')) return 'schedule';
    if (path.includes('/treatment')) return 'treatment';
    if (path.includes('/medical-record')) return 'medicalRecord';
    if (path.includes('/ddi')) return 'medication';
    if (path.includes('/ct-result') || path.includes('/mrna-result') || path.includes('/blood-result')) return 'examination';
    if (path.includes('/ai-')) return 'testForm';
    return 'home';
  }, [location.pathname]);

  const [sidebarTab, setSidebarTab] = useState<'waiting' | 'completed'>('waiting');
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [doctorName, setDoctorName] = useState<string>('의사');
  const [departmentName, setDepartmentName] = useState<string>('진료과');

  // 환자 정보 모달
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Custom Hooks로 데이터 관리
  const { waitingQueueData, fetchWaitingQueue } = useDoctorWaitingQueue(doctorId);
  const { stats, fetchStats } = useDoctorDashboardStats(doctorId);

  // 환자 목록을 상태별로 분류 (환자당 최신 encounter만 표시)
  const { waitingPatients, inProgressPatients, completedPatients } = useMemo(() => {
    if (!waitingQueueData?.queue) {
      return { waitingPatients: [], inProgressPatients: [], completedPatients: [] };
    }

    const waiting: Patient[] = [];
    const inProgress: Patient[] = [];
    const completed: Patient[] = [];

    if (waitingQueueData.queue.length === 0) {
      return { waitingPatients: [], inProgressPatients: [], completedPatients: [] };
    }

    // 환자별 최신 encounter만 필터링
    const patientMap = new Map<string, any>();
    waitingQueueData.queue.forEach((item: any) => {
      const patientObj = (typeof item.patient === 'object' && item.patient !== null) ? item.patient : null;
      const patientId = patientObj?.patient_id || item.patient_id || 'N/A';

      const existing = patientMap.get(patientId);
      if (!existing || new Date(item.created_at || item.queued_at) > new Date(existing.created_at || existing.queued_at)) {
        patientMap.set(patientId, item);
      }
    });

    // 최신 encounter만 처리
    patientMap.forEach((item: any) => {
      // workflow_state 직접 사용하여 분류
      const workflowState = item.workflow_state;

      // EncounterSerializer provides 'patient' as nested object
      const patientObj = (typeof item.patient === 'object' && item.patient !== null) ? item.patient : null;

      // Status mapping for display
      const status = mapWorkflowStateToStatus(workflowState);

      const patient: Patient = {
        encounterId: item.encounter_id,
        // patient_id is inside the nested patient object
        patientId: patientObj?.patient_id || 'N/A',
        name: item.patient_name || patientObj?.name || '이름 없음',
        birthDate: patientObj?.date_of_birth || 'N/A',
        age: patientObj?.age || 0,
        gender: patientObj?.gender === 'M' ? '남' : patientObj?.gender === 'F' ? '여' : 'N/A',
        status: status,
        queuedAt: item.created_at || item.queued_at,
        phone: patientObj?.phone || 'N/A',
        questionnaireStatus: item.questionnaire_status || 'NOT_STARTED',
        questionnaireData: item.questionnaire_data || null,
      };

      // 진료 완료: 수납 대기, 결과 대기, 촬영 대기/중
      if (['WAITING_PAYMENT', 'WAITING_RESULTS', 'WAITING_IMAGING', 'IN_IMAGING'].includes(workflowState)) {
        completed.push(patient);
      }
      // 진료 중
      else if (workflowState === 'IN_CLINIC') {
        inProgress.push(patient);
      }
      // 진료 대기
      else if (workflowState === 'WAITING_CLINIC') {
        waiting.push(patient);
      }
    });

    return { waitingPatients: waiting, inProgressPatients: inProgress, completedPatients: completed };
  }, [waitingQueueData]);

  const patientStatus = {
    waiting: stats.clinic_waiting + stats.clinic_in_progress, // 진료 대기 + 진료 중
    inProgress: stats.clinic_in_progress, // 진료 중
    completed: stats.completed_today, // 수납 대기, 결과 대기, 촬영 대기/중
  };

  // 환자 카드 클릭 핸들러 - 바로 상세 정보 모달 열기
  const handlePatientCardClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedPatientId(patient.patientId); // 환자 ID 전역 상태 설정
    setIsPatientModalOpen(true);
  }, [setSelectedPatientId]);

  // 진료 시작 핸들러
  const handleStartConsultation = useCallback(async (patient: Patient, event: React.MouseEvent) => {
    event.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    console.log(`[DoctorLayout] Starting consultation for patient: ${patient.name} (${patient.patientId})`);

    try {
      // 1. 상태 업데이트
      await updateEncounter(patient.encounterId, {
        workflow_state: 'IN_CLINIC'
      });
      console.log('[DoctorLayout] Encounter status updated to IN_CLINIC');

      // 2. 대기열 및 통계 새로고침 (병렬 처리)
      await Promise.all([
        fetchWaitingQueue(),
        fetchStats()
      ]);
      console.log('[DoctorLayout] Queue and stats refreshed');

      // 3. 선택된 encounter ID 및 Patient ID 설정
      setSelectedEncounterId(patient.encounterId);
      setSelectedPatientId(patient.patientId);
      console.log(`[DoctorLayout] Set context - EncounterId: ${patient.encounterId}, PatientId: ${patient.patientId}`);

      // 4. 진료 페이지로 이동
      console.log('[DoctorLayout] Navigating to /doctor/treatment');
      navigate('/doctor/treatment');

    } catch (error: any) {
      console.error('진료 시작 실패:', error);
      alert(error.response?.data?.message || '진료 시작에 실패했습니다.');
    }
  }, [fetchWaitingQueue, fetchStats, setSelectedEncounterId, setSelectedPatientId, navigate]);

  // WebSocket 실시간 알림 처리 (Global Context 사용)
  const { lastMessage } = useWebSocketContext();

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'queue_update') {
      console.log("🔔 실시간 업데이트 (DoctorLayout):", lastMessage.message);
      fetchWaitingQueue();
      fetchStats();
    }
  }, [lastMessage, fetchWaitingQueue, fetchStats]);

  /* 
  삭제된 로컬 WebSocket 연결 코드
  */

  useEffect(() => {
    // 의사 정보 로드
    const storedDoctor = localStorage.getItem('doctor');
    if (storedDoctor) {
      try {
        const doctorInfo = JSON.parse(storedDoctor);
        setDoctorId(doctorInfo.doctor_id || null);
        setDoctorName(doctorInfo.name || '의사');
        setDepartmentName(doctorInfo.department?.dept_name || '진료과');
      } catch (error) {
        console.error('의사 정보 파싱 실패:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (doctorId) {
      // 초기 데이터 로드
      fetchWaitingQueue();
      fetchStats();
    }
  }, [doctorId, fetchWaitingQueue, fetchStats]);

  return (
    <div className={styles.container}>
      {/* 왼쪽 사이드바 */}
      <DoctorSidebar
        doctorName={doctorName}
        departmentName={departmentName}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        stats={stats}
        waitingPatients={waitingPatients}
        inProgressPatients={inProgressPatients}
        completedPatients={completedPatients}
        onPatientCardClick={handlePatientCardClick}
        onStartConsultation={handleStartConsultation}
      />

      {/* 메인 영역 */}
      <div className={styles.mainArea}>
        {/* 상단 탭 바 */}
        <DoctorTopBar activeTab={activeTab} />

        {/* 메인 컨텐츠 영역 */}
        <div className={styles.mainContent}>
          <DoctorDataProvider
            value={{
              waitingQueueData,
              stats,
              fetchWaitingQueue,
              fetchStats,
              uniquePatientCounts: {
                waiting: waitingPatients.length + inProgressPatients.length,
                inProgress: inProgressPatients.length,
                completed: completedPatients.length
              }
            }}
          >
            <Outlet />
          </DoctorDataProvider>
        </div>
      </div>

      {/* 환자 정보 모달 */}
      <DoctorPatientModal
        isOpen={isPatientModalOpen}
        patient={selectedPatient}
        questionnaireData={selectedPatient?.questionnaireData}
        onClose={() => setIsPatientModalOpen(false)}
      />
    </div>
  );
}
