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

  // 환자 목록을 상태별로 분류
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

    waitingQueueData.queue.forEach((item: any) => {
      const status = mapWorkflowStateToStatus(item.workflow_state);

      const patient: Patient = {
        encounterId: item.encounter_id,
        patientId: item.patient_id || item.patient || 'N/A',
        name: item.patient_name || '이름 없음',
        birthDate: item.date_of_birth || 'N/A',
        age: item.age || 0,
        gender: item.gender === 'M' ? '남' : item.gender === 'F' ? '여' : 'N/A',
        status: status,
        queuedAt: item.created_at || item.queued_at,
        phone: item.phone || 'N/A',
        questionnaireStatus: item.questionnaire_status || 'NOT_STARTED',
        questionnaireData: item.questionnaire_data || null,
      };

      if (status === 'COMPLETED') {
        completed.push(patient);
      } else if (status === 'IN_PROGRESS') {
        inProgress.push(patient);
      } else {
        waiting.push(patient);
      }
    });

    return { waitingPatients: waiting, inProgressPatients: inProgress, completedPatients: completed };
  }, [waitingQueueData]);

  const patientStatus = {
    waiting: stats.clinic_waiting,
    inProgress: stats.clinic_in_progress,
    completed: stats.completed_today,
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
    try {
      await updateEncounter(patient.encounterId, {
        encounter_status: 'IN_CLINIC'
      });

      // 대기열 및 통계 새로고침
      await Promise.all([
        fetchWaitingQueue(),
        fetchStats()
      ]);

      // 선택된 encounter ID 및 Patient ID 설정 및 진료 페이지로 이동
      setSelectedEncounterId(patient.encounterId);
      setSelectedPatientId(patient.patientId);
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
        patientStatus={patientStatus}
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
              fetchStats
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
