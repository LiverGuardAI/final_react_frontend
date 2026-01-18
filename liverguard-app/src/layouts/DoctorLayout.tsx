import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import styles from './DoctorLayout.module.css';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useDoctorWaitingQueue } from '../hooks/useDoctorWaitingQueue';
import { useDoctorDashboardStats } from '../hooks/useDoctorDashboardStats';
import { getDoctorInProgressEncounter, updateEncounter } from '../api/doctorApi';
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

      const patientObj = (typeof item.patient === 'object' && item.patient !== null) ? item.patient : null;

      // 화면 표시용 상태 매핑
      const status = mapWorkflowStateToStatus(workflowState);

      const patient: Patient = {
        encounterId: item.encounter_id,
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

      // 진료 완료: 수납 대기, 결과 대기, 촬영 대기/중, 최종 완료
      if (['WAITING_PAYMENT', 'WAITING_RESULTS', 'WAITING_IMAGING', 'IN_IMAGING', 'COMPLETED'].includes(workflowState)) {
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
    waiting: stats.clinic_waiting, // 진료 대기
    inProgress: stats.clinic_in_progress, // 진료 중
    completed: stats.completed_today, // 수납 대기, 결과 대기, 촬영 대기/중
  };

  // 환자 카드 클릭 핸들러 - 바로 상세 정보 모달 열기
  const handlePatientCardClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedPatientId(patient.patientId); // 환자 ID 전역 상태 설정
    setIsPatientModalOpen(true);
  }, [setSelectedPatientId]);

  const handleResumeConsultation = useCallback((patient: Patient, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEncounterId(patient.encounterId);
    setSelectedPatientId(patient.patientId);
    navigate('/doctor/treatment');
  }, [setSelectedEncounterId, setSelectedPatientId, navigate]);

  // 진료 시작 핸들러
  const handleStartConsultation = useCallback(async (patient: Patient, event: React.MouseEvent) => {
    event.stopPropagation(); // 카드 클릭 이벤트 전파 방지

    // 1. 즉시 화면 전환 - API 응답을 기다리지 않고 먼저 이동하여 체감 속도 향상
    setSelectedEncounterId(patient.encounterId);
    setSelectedPatientId(patient.patientId);
    navigate('/doctor/treatment');

    try {
      // 2. 백그라운드에서 상태 업데이트
      await updateEncounter(patient.encounterId, {
        workflow_state: 'IN_CLINIC'
      });

      // 3. 대기열 및 통계 새로고침 (병렬 처리)
      await Promise.all([
        fetchWaitingQueue(),
        fetchStats()
      ]);

    } catch (error: any) {
      console.error('진료 시작 처리 실패:', error);
      // 이미 화면이 이동되었으므로 사용자에게 방해가 되지 않도록 조용히 처리하거나 토스트 메시지 등을 고려
    }
  }, [fetchWaitingQueue, fetchStats, setSelectedEncounterId, setSelectedPatientId, navigate]);

  // WebSocket 실시간 알림 처리 (Global Context 사용)
  const { lastMessage } = useWebSocketContext();

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'queue_update') {
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
      checkPendingSchedules();
    }
  }, [doctorId, fetchWaitingQueue, fetchStats]);

  const resolveActiveEncounter = useCallback(async () => {
    if (!doctorId || selectedPatientId) {
      return;
    }
    try {
      const inProgress: any = await getDoctorInProgressEncounter(doctorId);
      if (!inProgress) {
        return;
      }
      const patientObj =
        typeof inProgress.patient === 'object' && inProgress.patient !== null
          ? (inProgress.patient as { patient_id?: string })
          : null;
      const patientId = patientObj?.patient_id || inProgress.patient_id || null;
      if (patientId) {
        setSelectedPatientId(patientId);
      }
      if (inProgress.encounter_id) {
        setSelectedEncounterId(inProgress.encounter_id);
      }
    } catch (error) {
      console.error('진료 중 encounter 조회 실패:', error);
    }
  }, [doctorId, selectedPatientId, setSelectedEncounterId, setSelectedPatientId]);

  useEffect(() => {
    resolveActiveEncounter();
  }, [resolveActiveEncounter]);

  // 스케줄 확인 로직
  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const checkPendingSchedules = async () => {
    const userId = user?.user_id ?? user?.id;
    if (!userId) return;
    try {
      // 사용자(의사)의 모든 근무 일정 조회 (추후 백엔드 필터링 최적화 필요)
      const { getDutySchedules } = await import('../api/hospitalOpsApi');
      const data = await getDutySchedules(undefined, undefined, userId, 'PENDING');
      const pending = data;
      if (pending.length > 0) {
        setPendingSchedules(pending);
        setIsScheduleModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to check schedules", e);
    }
  };

  const handleConfirmSchedule = async (scheduleId: number) => {
    try {
      const { confirmDutySchedule } = await import('../api/hospitalOpsApi');
      await confirmDutySchedule(scheduleId);
      setPendingSchedules(prev => prev.filter(s => s.schedule_id !== scheduleId));
      if (pendingSchedules.length <= 1) {
        setIsScheduleModalOpen(false);
      }
      alert("스케줄이 확정되었습니다.");
    } catch (e) {
      console.error("Failed to confirm schedule", e);
      alert("스케줄 확정 실패");
    }
  };

  const handleRejectSchedule = async (scheduleId: number) => {
    const reason = window.prompt("거절 사유를 입력해주세요.\n(예: 개인 사정, 연차 사용 등)");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("거절 사유를 입력해주세요.");
      return;
    }
    try {
      const { rejectDutySchedule } = await import('../api/hospitalOpsApi');
      await rejectDutySchedule(scheduleId, reason);
      setPendingSchedules(prev => prev.filter(s => s.schedule_id !== scheduleId));
      if (pendingSchedules.length <= 1) {
        setIsScheduleModalOpen(false);
      }
      alert("스케줄을 거절(취소)했습니다.");
    } catch (e) {
      console.error("Failed to reject schedule", e);
      alert("스케줄 거절 실패");
    }
  };

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
        onResumeConsultation={handleResumeConsultation}
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
                waiting: waitingPatients.length,
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

      {/* 스케줄 확정 모달 */}
      {isScheduleModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ margin: '0 0 15px' }}>📅 근무 일정 확인 요청</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
              관리자가 등록한 근무 일정이 있습니다. 확인해 주세요.
            </p>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
              {pendingSchedules.map(sch => (
                <div key={sch.schedule_id} style={{
                  border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '8px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {new Date(sch.start_time).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      {new Date(sch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                      {new Date(sch.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <br />
                      ({sch.shift_type})
                    </div>
                  </div>
                  <button
                    onClick={() => handleConfirmSchedule(sch.schedule_id)}
                    style={{
                      background: '#2196F3', color: 'white', border: 'none', padding: '6px 12px',
                      borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    확정
                  </button>
                  <button
                    onClick={() => handleRejectSchedule(sch.schedule_id)}
                    style={{
                      background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px',
                      borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '6px'
                    }}
                  >
                    거절
                  </button>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                style={{
                  background: '#f5f5f5', color: '#333', border: 'none', padding: '8px 16px',
                  borderRadius: '6px', cursor: 'pointer'
                }}
              >
                닫기 (나중에 확인)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
