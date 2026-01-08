import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DoctorLayout.module.css';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDoctorWaitingQueue } from '../hooks/useDoctorWaitingQueue';
import { useDoctorDashboardStats } from '../hooks/useDoctorDashboardStats';
import { updateEncounter } from '../api/doctorApi';
import DoctorPatientModal from '../components/doctor/DoctorPatientModal';
import { useTreatment } from '../contexts/TreatmentContext';

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

type TabType = 'home' | 'schedule' | 'treatment' | 'patientManagement' | 'examination' | 'testForm' | 'medication';

interface DoctorLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
}

export default function DoctorLayout({ children, activeTab }: DoctorLayoutProps) {
  const navigate = useNavigate();
  const { setSelectedEncounterId } = useTreatment();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
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
  const rawStatus = item.encounter_status;
      const patient: Patient = {
        encounterId: item.encounter_id,
        patientId: item.patient_id || item.patient || 'N/A',
        name: item.patient_name || '이름 없음',
        birthDate: item.date_of_birth || 'N/A',
        age: item.age || 0,
        gender: item.gender === 'M' ? '남' : item.gender === 'F' ? '여' : 'N/A',
  status: (rawStatus as Patient['status']) || 'WAITING',
        queuedAt: item.created_at || item.queued_at,
        phone: item.phone || 'N/A',
        questionnaireStatus: item.questionnaire_status || 'NOT_STARTED',
        questionnaireData: item.questionnaire_data || null,
      };

      if (rawStatus === 'COMPLETED') {
        completed.push(patient);
      } else if (rawStatus === 'IN_PROGRESS') {
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

  const handleMouseEnter = (dropdown: string) => {
    setOpenDropdown(dropdown);
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  const handleDropdownItemClick = (item: string) => {
    console.log(`Dropdown item clicked: ${item}`);
    setOpenDropdown(null);

    // 드롭다운 아이템에 따라 페이지 이동
    if (item === 'CT 촬영 결과') {
      navigate('/doctor/ct-result');
    } else if (item === '유전체 검사 결과') {
      navigate('/doctor/mrna-result');
    } else if (item === '혈액 검사 결과') {
      navigate('/doctor/blood-result');
    } else if (item === '병기예측') {
      navigate('/doctor/ai-stage-prediction');
    } else if (item === '조기재발예측') {
      navigate('/doctor/ai-recurrence-prediction');
    } else if (item === '생존분석') {
      navigate('/doctor/ai-survival-analysis');
    }
  };

  const handleTabClick = (tab: TabType) => {
    setOpenDropdown(null);
    switch (tab) {
      case 'home':
        navigate('/doctor/home');
        break;
      case 'schedule':
        navigate('/doctor/schedule');
        break;
      case 'treatment':
        navigate('/doctor/treatment');
        break;
      case 'testForm':
        navigate('/doctor/ai-result');
        break;
      case 'patientManagement':
        navigate('/doctor/patient-management');
        break;
      case 'medication':
        navigate('/doctor/ddi');
        break;
      default:
        break;
    }
  };

  // 환자 카드 클릭 핸들러 - 바로 상세 정보 모달 열기
  const handlePatientCardClick = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsPatientModalOpen(true);
  };

  // 진료 시작 핸들러
  const handleStartConsultation = async (patient: Patient, event: React.MouseEvent) => {
    event.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    try {
      await updateEncounter(patient.encounterId, {
        encounter_status: 'IN_PROGRESS'
      });

      // 대기열 및 통계 새로고침
      await Promise.all([
        fetchWaitingQueue(),
        fetchStats()
      ]);

      // 선택된 encounter ID 설정 및 진료 페이지로 이동
      setSelectedEncounterId(patient.encounterId);
      navigate('/doctor/treatment');
    } catch (error: any) {
      console.error('진료 시작 실패:', error);
      alert(error.response?.data?.message || '진료 시작에 실패했습니다.');
    }
  };

  // WebSocket 실시간 알림 처리
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  const WS_URL = `${protocol}//${hostname}:8000/ws/clinic/`;

  useWebSocket(WS_URL, {
    onMessage: (data) => {
      if (data.type === 'queue_update') {
        console.log("🔔 실시간 업데이트:", data.message);
        // WebSocket 메시지 수신 시 대기열과 통계 새로고침
        fetchWaitingQueue();
        fetchStats();
      }
    },
    onOpen: () => {
      console.log("✅ WebSocket 연결 성공");
    },
    onClose: () => {
      console.log("⚠️ WebSocket 연결 종료 (5초 후 자동 재연결)");
    },
    onError: () => {
      console.error("❌ WebSocket 에러");
    },
    enabled: !!doctorId,
  });

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
      <div className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          {/* 프로필 섹션 */}
          <div className={styles.profileSection}>
            <div className={styles.profileImage}></div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{doctorName}</div>
              <div className={styles.departmentTag}>{departmentName}</div>
              <div className={styles.statusInfo}>
                상태: <span className={styles.statusBadge}>근무중</span>
              </div>
            </div>
          </div>

          {/* 환자 리스트 섹션 */}
          <div className={styles.patientListSection}>
            <div className={styles.patientListTabs}>
              <button
                className={`${styles.patientListTab} ${sidebarTab === 'waiting' ? styles.active : ''}`}
                onClick={() => setSidebarTab('waiting')}
              >
                진료대기 ({patientStatus.waiting}명)
              </button>
              <button
                className={`${styles.patientListTab} ${sidebarTab === 'completed' ? styles.active : ''}`}
                onClick={() => setSidebarTab('completed')}
              >
                진료완료 ({patientStatus.completed}명)
              </button>
            </div>

            <div className={styles.patientListContent}>
              {sidebarTab === 'waiting' && (
                <>
                  {/* 진료중인 환자 (상단 우선 표시) */}
                  {inProgressPatients.map((patient) => (
                    <div
                      key={patient.encounterId}
                      className={`${styles.patientCard} ${styles.inProgress}`}
                      onClick={() => handlePatientCardClick(patient)}
                      style={{ cursor: 'pointer', borderLeft: '4px solid #6C5CE7' }}
                    >
                      <div className={styles.patientHeader}>
                        <span className={styles.patientName}>{patient.name}</span>
                        <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                      </div>
                      <div className={styles.patientDetails}>
                        {patient.birthDate} | {patient.age}세 | {patient.gender}
                      </div>
                      <div className={styles.patientActions}>
                        <span style={{
                          background: '#6C5CE7',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          진료중
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                        {patient.queuedAt ? new Date(patient.queuedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : 'N/A'}
                      </div>
                    </div>
                  ))}

                  {/* 대기중인 환자 */}
                  {waitingPatients.map((patient) => (
                    <div
                      key={patient.encounterId}
                      className={styles.patientCard}
                      onClick={() => handlePatientCardClick(patient)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.patientHeader}>
                        <span className={styles.patientName}>{patient.name}</span>
                        <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                      </div>
                      <div className={styles.patientDetails}>
                        {patient.birthDate} | {patient.age}세 | {patient.gender}
                      </div>
                      <div className={styles.patientActions}>
                        <button
                          className={`${styles.actionButton} ${styles.start}`}
                          onClick={(e) => handleStartConsultation(patient, e)}
                        >
                          진료시작
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                        {patient.queuedAt ? new Date(patient.queuedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : 'N/A'}
                      </div>
                    </div>
                  ))}

                  {inProgressPatients.length === 0 && waitingPatients.length === 0 && (
                    <div className={styles.emptyState}>대기 중인 환자가 없습니다</div>
                  )}
                </>
              )}

              {sidebarTab === 'completed' && (
                <>
                  {completedPatients.length > 0 ? (
                    completedPatients.map((patient) => (
                      <div
                        key={patient.encounterId}
                        className={styles.patientCard}
                        onClick={() => handlePatientCardClick(patient)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.patientHeader}>
                          <span className={styles.patientName}>{patient.name}</span>
                          <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                        </div>
                        <div className={styles.patientDetails}>
                          {patient.birthDate} | {patient.age}세 | {patient.gender}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>완료된 진료가 없습니다</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className={styles.mainArea}>
        {/* 상단 탭 바 */}
        <div className={styles.topBar}>
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${activeTab === 'home' ? styles.active : ''}`}
              onClick={() => handleTabClick('home')}
            >
              <span>홈</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'treatment' ? styles.active : ''}`}
              onClick={() => handleTabClick('treatment')}
            >
              <span>환자 진료</span>
            </button>

            <div
              style={{ position: 'relative', flex: 1, maxWidth: '150px' }}
              onMouseEnter={() => handleMouseEnter('examination')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`${styles.tabButton} ${styles.hasDropdown} ${openDropdown === 'examination' ? styles.active : ''}`}
              >
                <span>검사 결과</span>
              </button>
              {openDropdown === 'examination' && (
                <div className={styles.dropdownMenu}>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('CT 촬영 결과')}
                  >
                    CT 촬영 결과
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('유전체 검사 결과')}
                  >
                    유전체 검사 결과
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('혈액 검사 결과')}
                  >
                    혈액 검사 결과
                  </button>
                </div>
              )}
            </div>

            <div
              style={{ position: 'relative', flex: 1, maxWidth: '150px' }}
              onMouseEnter={() => handleMouseEnter('aiAnalysis')}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`${styles.tabButton} ${styles.hasDropdown} ${openDropdown === 'aiAnalysis' ? styles.active : ''}`}
              >
                <span>AI분석</span>
              </button>
              {openDropdown === 'aiAnalysis' && (
                <div className={styles.dropdownMenu}>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('병기예측')}
                  >
                    병기예측
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('조기재발예측')}
                  >
                    조기재발예측
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('생존분석')}
                  >
                    생존분석
                  </button>
                </div>
              )}
            </div>

            <button
              className={`${styles.tabButton} ${activeTab === 'patientManagement' ? styles.active : ''}`}
              onClick={() => handleTabClick('patientManagement')}
            >
              <span>환자 관리</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.active : ''}`}
              onClick={() => handleTabClick('schedule')}
            >
              <span>일정 관리</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'medication' ? styles.active : ''}`}
              onClick={() => handleTabClick('medication')}
            >
              <span>약물 상호작용</span>
            </button>
          </div>

          {/* 우측 아이콘 */}
          <div className={styles.topBarIcons}>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Messages clicked')}
              title="메시지"
            >
              <svg className={styles.messageIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Notifications clicked')}
              title="알림"
            >
              <svg className={styles.bellIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Logout clicked')}
              title="로그아웃"
            >
              <svg className={styles.logoutIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className={styles.mainContent}>
          {children}
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
