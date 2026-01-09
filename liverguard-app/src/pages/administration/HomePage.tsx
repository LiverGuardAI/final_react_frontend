import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useWaitingQueue } from "../../hooks/useWaitingQueue";
import { useDashboardStats } from "../../hooks/useDashboardStats";
import { useDoctors } from "../../hooks/useDoctors";
import { useAdministrationData } from "../../contexts/AdministrationContext";
import { usePatients } from "../../hooks/usePatients";
import {
  registerPatient,
  getPatientDetail,
  updatePatient,
  type PatientRegistrationData,
  type PatientUpdateData
} from "../../api/administrationApi";
import {
  createEncounter,
  getAppointments,
  updateAppointment,
  cancelEncounter,
  updateEncounter,
  createQuestionnaire
} from "../../api/administration_api";
import styles from './HomePage.module.css';
import SchedulePage from './SchedulePage';
import AppointmentManagementPage from './AppointmentManagementPage';
import PatientManagementPage from './PatientManagementPage';
import CheckinModal from '../../components/administration/CheckinModal';
import PatientSearchPanel from '../../components/administration/PatientSearchPanel';
import PatientRegistrationForm from '../../components/administration/PatientRegistrationForm';
import PatientDetailModal from '../../components/administration/PatientDetailModal';
import QuestionnaireModal, { type QuestionnaireData } from '../../components/administration/QuestionnaireModal';
import PatientActionModal from '../../components/administration/PatientActionModal';
import EncounterDetailModal from '../../components/administration/EncounterDetailModal';
import OrderList from '../../components/administration/OrderList';



interface Patient {
  id: string;  // patient_id is a string like "P251230002"
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  phone: string;
  emergencyContact: string;
  address: string;
  registrationDate: string;
  lastVisit?: string;
}

interface Appointment {
  id: number;
  time: string;
  patientName: string;
  phone: string;
  doctor: string;
  consultationType: string;
  status: string;
  appointmentDate?: string;
  patientId?: string;
  doctorId?: number;
  appointmentId?: number;
  createdAt?: string;
}

interface ClinicWaiting {
  id: number;
  clinicName: string;
  doctorName: string;
  roomNumber: string;
  patients: {
    encounterId: number;
    name: string;
    phone: string;
    status: '진료중' | '대기중' | '진료완료';
  }[];
}

interface Doctor {
  doctor_id: number;
  name: string;
  department: {
    dept_name: string;
  };
  room_number?: string;
}

type TabType = 'home' | 'schedule' | 'appointments' | 'patients';
type ContentTabType = 'search' | 'newPatient' | 'appointments';
type ReceptionTabType = 'reception' | 'additional' | 'payment';

export default function AdministrationHomePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [staffName, setStaffName] = useState<string>('원무과');
  const [departmentName, setDepartmentName] = useState<string>('부서');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [contentTab, setContentTab] = useState<ContentTabType>('search');
  const [receptionTab, setReceptionTab] = useState<ReceptionTabType>('reception');
  const [searchQuery, setSearchQuery] = useState('');

  // 신규 환자 등록은 PatientRegistrationForm 컴포넌트에서 처리

  // Custom Hook으로 환자 관리 (Local usePatients for pagination isolation if desired, or use global if provided)
  // HomePage specific: Pagination is local.
  const { patients, fetchPatients, isLoading: isLoadingPatients, currentPage, setCurrentPage } = usePatients();
  const patientsPerPage = 5;

  // Context Data
  const {
    waitingQueueData: queueData,
    dashboardStats,
    fetchWaitingQueue,
    fetchDashboardStats,
    doctors: sidebarDoctors,
    fetchDoctors,
    refreshPatientsTrigger
  } = useAdministrationData();

  // 환자 목록 리프레시 트리거 감지
  useEffect(() => {
    if (currentPage === 1) { // Only refresh if on first page to avoid jumping
      fetchPatients(searchQuery, 1);
    }
  }, [refreshPatientsTrigger, fetchPatients, searchQuery, currentPage]);

  // 환자 상세 모달
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    phone: '',
  });

  // 현장 접수 모달
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinPatient, setCheckinPatient] = useState<Patient | null>(null);

  // 문진표 모달
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [questionnairePatient, setQuestionnairePatient] = useState<Patient | null>(null);
  const [lastEncounterId, setLastEncounterId] = useState<number | null>(null);
  const [questionnaireInitialData, setQuestionnaireInitialData] = useState<QuestionnaireData | null>(null);

  // Completed Patient View Modal State
  const [isEncounterModalOpen, setIsEncounterModalOpen] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(null);
  const [selectedPatientNameForModal, setSelectedPatientNameForModal] = useState<string>('');

  // 환자 작업 선택 모달
  const [isPatientActionModalOpen, setIsPatientActionModalOpen] = useState(false);
  const [selectedWaitingPatient, setSelectedWaitingPatient] = useState<any>(null);

  // 실시간 대기열 데이터 (Hooks에서 가져온 데이터를 로컬 상태로 유지)
  const [waitingQueueData, setWaitingQueueData] = useState<any>(null);

  // 금일 예약 데이터
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // 예약 승인 모달
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentDoctor, setAppointmentDoctor] = useState<number | null>(null);

  // 진료실별 대기 현황 뷰 모드 ('WAITING' | 'COMPLETED')
  const [clinicViewModes, setClinicViewModes] = useState<Record<number, 'WAITING' | 'COMPLETED'>>({});

  // 오더 목록 리프레시 및 알림
  const [orderRefreshTrigger, setOrderRefreshTrigger] = useState(0);
  const [notification, setNotification] = useState<{ message: string, type: string } | null>(null);

  // WebSocket for Notifications
  useWebSocket('ws://127.0.0.1:8000/ws/clinic/', {
    onMessage: (data) => {
      if (data.type === 'new_order') {
        const msg = data.message || '새로운 오더가 도착했습니다.';
        setNotification({ message: msg, type: 'info' });
        setOrderRefreshTrigger(prev => prev + 1);

        // 3초 후 알림 닫기
        setTimeout(() => setNotification(null), 3000);
      }
    }
  });

  const toggleClinicViewMode = (doctorId: number) => {
    setClinicViewModes(prev => ({
      ...prev,
      [doctorId]: prev[doctorId] === 'COMPLETED' ? 'WAITING' : 'COMPLETED'
    }));
  };

  // 진료실별 대기 현황 계산 - useMemo로 최적화
  const clinicWaitingList = useMemo((): ClinicWaiting[] => {
    // 1. 근무 중인 의사가 없으면 빈 배열
    if (sidebarDoctors.length === 0) return [];

    const parseRoomNumber = (room?: string) => {
      if (!room) return Number.POSITIVE_INFINITY;
      const numeric = Number.parseInt(room.replace(/\D/g, ''), 10);
      return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
    };

    const sortedDoctors = [...sidebarDoctors].sort((a, b) => {
      const aRoom = parseRoomNumber(a.room_number);
      const bRoom = parseRoomNumber(b.room_number);
      if (aRoom !== bRoom) {
        return aRoom - bRoom;
      }
      return a.name.localeCompare(b.name);
    });

    // 2. 각 의사별로 대기열(Queue)에서 환자를 찾아서 매칭
    return sortedDoctors.map((doctor) => {
      // 현재 이 의사에게 배정된 환자 찾기
      const myPatients = waitingQueueData?.queue?.filter((q: any) =>
        // 주의: API 응답의 doctor_id 필드명 확인 필요 (보통 doctor_id 또는 doctor)
        q.doctor_id === doctor.doctor_id || q.doctor === doctor.doctor_id
      ) || [];

      // 환자 정보 매핑 및 정렬 (진료중 환자가 맨 위로)
      const formattedPatients = myPatients
        .map((p: any) => {
          let statusText = '대기중';
          if (p.encounter_status === 'IN_PROGRESS' || p.encounter_status === 'IN_CLINIC') statusText = '진료중';
          else if (p.encounter_status === 'WAITING_RESULTS') statusText = '결과대기';
          else if (p.encounter_status === 'COMPLETED') statusText = '진료완료';

          return {
            encounterId: p.encounter_id,
            name: p.patient_name || '이름 없음',
            phone: '010-****-****', // 개인정보 마스킹
            status: statusText as '진료중' | '대기중' | '진료완료',
            patientId: p.patient || p.patient_id, // Rendering에서 사용될 수 있음
            encounter_status: p.encounter_status, // 정렬용
            checkin_time: p.checkin_time // 대기시간 계산용
          };
        })
        .sort((a: any, b: any) => {
          // 1순위: 진료중(IN_PROGRESS)이 먼저
          if (a.encounter_status === 'IN_PROGRESS' && b.encounter_status !== 'IN_PROGRESS') return -1;
          if (a.encounter_status !== 'IN_PROGRESS' && b.encounter_status === 'IN_PROGRESS') return 1;
          // 2순위: 대기 시간 순 (checkin_time 오름차순) - 완료된 환자는 업데이트 시간 역순이 좋을수도 있지만 일단 유지
          return 0;
        });

      return {
        id: doctor.doctor_id,
        clinicName: doctor.department.dept_name,
        roomNumber: doctor.room_number ? `${doctor.room_number}호` : '미배정',
        doctorName: doctor.name,
        patients: formattedPatients
      };
    });
  }, [sidebarDoctors, waitingQueueData]);

  // 대기 중인 환자 ID 목록 계산
  const waitingPatientIds = useMemo(() => {
    if (!waitingQueueData?.queue) return [];
    return waitingQueueData.queue.map((q: any) => q.patient_id || q.patient).filter(Boolean);
  }, [waitingQueueData]);

  // 대기열 데이터 업데이트
  useEffect(() => {
    if (queueData) {
      setWaitingQueueData(queueData);
    }
  }, [queueData]);

  // 4. 금일 예약 조회
  const fetchTodayAppointments = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getAppointments({ date: today });

      // API 응답을 UI 형식에 맞게 변환
      const formattedAppointments: Appointment[] = data.results.map((apt: any) => ({
        id: apt.appointment_id,
        time: `${apt.appointment_time || 'N/A'}`,
        patientName: apt.patient_name || '이름 없음',
        phone: apt.patient?.date_of_birth || 'N/A',
        doctor: apt.doctor_name || '미배정',
        consultationType: apt.notes || apt.appointment_type || '일반 진료',
        status: apt.status || '예약완료',
        // 추가 정보 저장
        appointmentDate: apt.appointment_date,
        patientId: apt.patient,
        doctorId: apt.doctor,
        appointmentId: apt.appointment_id,
        createdAt: apt.created_at
      }));

      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('예약 조회 실패:', error);
    }
  }, []);

  // WebSocket은 useWaitingQueue와 useDashboardStats 내부에서 이미 연결되므로
  // 여기서는 중복 연결하지 않음

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    // 나중에 각 탭에 맞는 페이지로 라우팅 추가 가능
    // switch (tab) {
    //   case 'home':
    //     navigate('/administration/home');
    //     break;
    //   case 'schedule':
    //     navigate('/administration/schedule');
    //     break;
    //   ...
    // }
  };

  useEffect(() => {
    // 관리자 정보 로드 (있으면)
    const storedAdmin = localStorage.getItem('administration');
    if (storedAdmin) {
      try {
        const adminStaff = JSON.parse(storedAdmin) as { name?: string; department?: string };
        if (adminStaff.name) {
          setStaffName(adminStaff.name);
        }
        if (adminStaff.department) {
          setDepartmentName(adminStaff.department);
        }
      } catch (error) {
        console.error('Failed to parse administration info from storage', error);
      }
    }

    // 의사 목록 로드 (진료실 정보)
    fetchDoctors();

    // 초기 환자 목록 로드
    fetchPatients();

    // 대기열 및 통계 로드 (초기 1회만)
    fetchWaitingQueue();
    fetchDashboardStats();
    fetchTodayAppointments();

    // WebSocket으로 실시간 업데이트 받으므로 폴링 제거
    // 필요시 수동 새로고침만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열: 컴포넌트 마운트 시 한 번만 실행

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('administration');

    logout();
    navigate('/');
  };

  // 신규 환자 등록 제출 (PatientRegistrationForm에서 사용)
  const handlePatientRegistrationSubmit = async (data: PatientRegistrationData) => {
    const response = await registerPatient(data);
    alert(`환자 등록 완료: ${response.patient.name} (${response.patient.patient_id})`);
    setContentTab('search');
    fetchPatients(); // 목록 갱신
  };

  // 검색어 변경 시 환자 목록 갱신
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    fetchPatients(value, 1);
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(patients.length / patientsPerPage);
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = patients.slice(indexOfFirstPatient, indexOfLastPatient);

  // 페이지 변경 핸들러
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // 환자 클릭 핸들러 (상세 정보 모달 열기)
  const handlePatientClick = async (patient: Patient) => {
    try {
      const detailData = await getPatientDetail(patient.id.toString());
      setSelectedPatient({
        ...patient,
        ...detailData,
      });
      setEditForm({
        name: detailData.name || '',
        date_of_birth: detailData.date_of_birth || '',
        gender: detailData.gender || '',
        phone: detailData.phone || '',
      });
      setIsModalOpen(true);
      setIsEditing(false);
    } catch (error) {
      console.error('환자 상세 정보 조회 실패:', error);
      alert('환자 정보를 불러오는데 실패했습니다.');
    }
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPatient(null);
    setIsEditing(false);
  };

  // 수정 모드 전환
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  // 수정 폼 입력 핸들러
  const handleEditFormChange = (field: keyof typeof editForm, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // 환자 정보 수정 제출
  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    try {
      const updateData: PatientUpdateData = {
        name: editForm.name,
        date_of_birth: editForm.date_of_birth,
        gender: editForm.gender as 'M' | 'F',
        phone: editForm.phone || undefined,
      };

      await updatePatient(selectedPatient.id.toString(), updateData);

      // 수정된 환자 정보로 selectedPatient 업데이트
      setSelectedPatient({
        ...selectedPatient,
        name: editForm.name,
        birthDate: editForm.date_of_birth,
        gender: editForm.gender === 'M' ? '남' : editForm.gender === 'F' ? '여' : 'N/A',
        phone: editForm.phone || 'N/A',
      });

      // 수정 모드 종료
      setIsEditing(false);

      alert('환자 정보가 수정되었습니다.');

      // 환자 목록 새로고침
      await fetchPatients();
    } catch (error: any) {
      console.error('환자 정보 수정 실패:', error);
      alert('환자 정보 수정에 실패했습니다.');
    }
  };

  // 현장 접수 버튼 클릭 (의사 선택 모달 열기)
  const handleCheckinClick = async (patient: Patient) => {
    try {
      setCheckinPatient(patient);
      await fetchDoctors(); // 최신 의사 목록 갱신
      setIsCheckinModalOpen(true);
    } catch (error) {
      console.error('의사 목록 조회 실패:', error);
      alert('의사 목록을 불러오는데 실패했습니다.');
    }
  };

  // 현장 접수 제출 (CheckinModal에서 사용)
  const handleCheckinSubmit = async (patientId: string, doctorId: number) => {
    try {
      const now = new Date();

      // 선택된 의사의 부서 정보 가져오기
      const selectedDoctor = sidebarDoctors.find(d => d.doctor_id === doctorId);

      const encounterData = {
        patient: patientId,
        doctor: doctorId,
        encounter_date: now.toISOString().split('T')[0],
        encounter_time: now.toTimeString().split(' ')[0].substring(0, 8),
        chief_complaint: '접수 완료',
        is_first_visit: false,
        department: selectedDoctor?.department?.dept_name || '일반',
        priority: 5,
        workflow_state: 'WAITING_CLINIC',
      };

      const response = await createEncounter(encounterData);

      // Encounter ID 저장
      const encounterId = response.encounter?.encounter_id || response.encounter_id;
      console.log('생성된 Encounter ID:', encounterId);
      setLastEncounterId(encounterId);

      // 접수 완료 - 체크인 모달 먼저 닫기
      setIsCheckinModalOpen(false);

      // 대기열 새로고침 (백그라운드에서)
      Promise.all([
        fetchWaitingQueue(),
        fetchDashboardStats()
      ]).catch(err => console.error('대기열 새로고침 실패:', err));

      // 문진표 작성 여부 물어보기
      const writeQuestionnaire = window.confirm('접수가 완료되었습니다.\n문진표를 작성하시겠습니까?');

      if (writeQuestionnaire) {
        setQuestionnairePatient(checkinPatient);
        setIsQuestionnaireModalOpen(true);
      }
    } catch (error: any) {
      console.error('접수 처리 실패:', error);
      alert(error.response?.data?.message || '접수 처리 중 오류가 발생했습니다.');
    }
  };

  // 대기 취소 핸들러
  const handleCancelWaiting = async (encounterId: number, patientName: string) => {
    const confirmed = window.confirm(`${patientName} 환자의 대기를 취소하시겠습니까?`);

    if (!confirmed) return;

    try {
      await cancelEncounter(encounterId);
      alert('대기가 취소되었습니다.');

      // 대기열 새로고침
      await Promise.all([
        fetchWaitingQueue(),
        fetchDashboardStats()
      ]);
    } catch (error: any) {
      console.error('대기 취소 실패:', error);
      alert(error.response?.data?.message || '대기 취소 중 오류가 발생했습니다.');
    }
  };

  // 문진표 작업 핸들러 (PatientActionModal에서 호출)
  const handleOpenQuestionnaireFromAction = () => {
    if (!selectedWaitingPatient) return;

    setLastEncounterId(selectedWaitingPatient.encounter_id);
    setQuestionnairePatient({
      id: selectedWaitingPatient.patient || selectedWaitingPatient.patient_id,
      name: selectedWaitingPatient.patient_name || '이름 없음',
      birthDate: selectedWaitingPatient.date_of_birth || 'N/A',
      age: selectedWaitingPatient.age || 0,
      gender: selectedWaitingPatient.gender === 'M' ? '남' : selectedWaitingPatient.gender === 'F' ? '여' : 'N/A',
      phone: selectedWaitingPatient.phone || 'N/A',
      emergencyContact: '',
      address: '',
      registrationDate: selectedWaitingPatient.created_at ? selectedWaitingPatient.created_at.split('T')[0] : 'N/A'
    });

    // 기존 문진표 데이터가 있으면 불러오기
    if (selectedWaitingPatient.questionnaire_data) {
      setQuestionnaireInitialData(selectedWaitingPatient.questionnaire_data);
    } else {
      setQuestionnaireInitialData(null);
    }

    setIsQuestionnaireModalOpen(true);
  };

  // 문진표 제출 핸들러
  const handleQuestionnaireSubmit = async (data: QuestionnaireData) => {
    try {
      if (lastEncounterId) {
        // 기존 Encounter 업데이트 (현장 접수 후 문진표 작성)
        console.log('Encounter 업데이트:', lastEncounterId);
        await updateEncounter(lastEncounterId, {
          questionnaire_data: data,
          questionnaire_status: 'COMPLETED'
        });
        alert('문진표가 제출되었습니다.');
      } else {
        // Encounter ID가 없으면 새로 생성 (환자 관리 탭에서 문진표 작성할 때)
        console.log('새 Encounter 생성');
        await createQuestionnaire(data);
        alert('문진표가 제출되었습니다.');
      }

      // 대기열 새로고침
      Promise.all([
        fetchWaitingQueue(),
        fetchDashboardStats()
      ]).catch(err => console.error('대기열 새로고침 실패:', err));

      setIsQuestionnaireModalOpen(false);
      setQuestionnairePatient(null);
      setLastEncounterId(null); // 초기화
    } catch (error: any) {
      console.error('문진표 제출 실패:', error);
      alert(error.response?.data?.message || '문진표 제출 중 오류가 발생했습니다.');
    }
  };

  // 문진표 삭제 핸들러
  const handleQuestionnaireDelete = async () => {
    try {
      if (lastEncounterId) {
        console.log('문진표 삭제 (Encounter 업데이트):', lastEncounterId);
        await updateEncounter(lastEncounterId, {
          questionnaire_data: null,
          questionnaire_status: 'NOT_STARTED'
        });
        alert('문진표가 삭제되었습니다.');

        // 대기열 새로고침
        Promise.all([
          fetchWaitingQueue(),
          fetchDashboardStats()
        ]).catch(err => console.error('대기열 새로고침 실패:', err));

        setIsQuestionnaireModalOpen(false);
        setQuestionnairePatient(null);
        setLastEncounterId(null);
      }
    } catch (error: any) {
      console.error('문진표 삭제 실패:', error);
      alert(error.response?.data?.message || '문진표 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className={styles.container}>
      {/* 왼쪽 사이드바 */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          {/* 프로필 섹션 */}
          <div className={styles.profileSection}>
            <div className={styles.profileImage}></div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{staffName}</div>
              <div className={styles.departmentTag}>{departmentName}</div>
              <div className={styles.statusInfo}>
                상태: <span className={styles.statusBadge}>근무중</span>
              </div>
            </div>
          </div>

          {/* 총 대기 현황 섹션 */}
          <div className={styles.waitingSection}>
            <div className={styles.waitingSectionTitle}>총 대기 현황</div>
            <div className={styles.waitingList}>
              {!waitingQueueData || !waitingQueueData.queue || waitingQueueData.queue.length === 0 ? (
                <div style={{ color: '#333', padding: '20px', textAlign: 'center', opacity: 0.7 }}>
                  대기 중인 환자가 없습니다.
                </div>
              ) : (
                <>
                  {/* 진료중인 환자 먼저 표시 */}
                  {waitingQueueData.queue
                    .filter((item: any) => item.encounter_status === 'IN_PROGRESS')
                    .map((queueItem: any, index: number) => {
                      const doctorId = queueItem.doctor_id || queueItem.doctor;
                      const doctor = sidebarDoctors.find(d => d.doctor_id === doctorId);
                      const questionnaireStatus = queueItem.questionnaire_status || 'NOT_STARTED';

                      let questionnaireDisplay = '미작성';
                      if (questionnaireStatus === 'COMPLETED') {
                        questionnaireDisplay = '작성완료';
                      } else if (questionnaireStatus === 'IN_PROGRESS') {
                        questionnaireDisplay = '작성중';
                      }
                      let questionnaireBadgeStyle = {};

                      if (questionnaireStatus === 'COMPLETED') {
                        questionnaireBadgeStyle = { backgroundColor: '#4CAF50', color: 'white' };
                      } else if (questionnaireStatus === 'IN_PROGRESS') {
                        questionnaireBadgeStyle = { backgroundColor: '#FF9800', color: 'white' };
                      } else {
                        questionnaireBadgeStyle = { backgroundColor: '#9E9E9E', color: 'white' };
                      }

                      const handlePatientClick = () => {
                        setSelectedWaitingPatient(queueItem);
                        setIsPatientActionModalOpen(true);
                      };

                      return (
                        <div
                          key={`inprogress-${index}`}
                          className={styles.totalWaitingPatientCard}
                          onClick={handlePatientClick}
                          style={{ cursor: 'pointer', borderLeft: '4px solid #6C5CE7', backgroundColor: '#F5F3FF' }}
                          title="클릭하여 문진표 작성/확인"
                        >
                          <div className={styles.patientMainInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75em', fontWeight: 'bold', color: '#6C5CE7', minWidth: '30px' }}>
                                진료중
                              </span>
                              <span style={{ fontSize: '1em', fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap' }}>
                                {queueItem.patient_name || '이름 없음'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <span
                                className={styles.questionnaireBadge}
                                style={{
                                  fontSize: '0.7em',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  ...questionnaireBadgeStyle
                                }}
                              >
                                {questionnaireDisplay}
                              </span>
                              <span className={`${styles.statusTag} ${styles.진료중}`} style={{ fontSize: '0.75em', whiteSpace: 'nowrap' }}>
                                진료중
                              </span>
                            </div>
                          </div>
                          <div className={styles.patientDetailInfo}>
                            <div style={{ fontSize: '0.75em', color: '#555' }}>
                              환자ID: {queueItem.patient || 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#555' }}>
                              접수시간: {queueItem.created_at ? new Date(queueItem.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#555' }}>
                              배정: {doctor ? `${doctor.name} (${doctor.room_number || '미배정'}호)` : queueItem.doctor_name || '정보 없음'}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* 대기중인 환자 표시 */}
                  {waitingQueueData.queue
                    .filter((item: any) => item.encounter_status !== 'IN_PROGRESS' && item.encounter_status !== 'COMPLETED')
                    .map((queueItem: any, index: number) => {
                      // 해당 환자의 의사 정보 찾기
                      const doctorId = queueItem.doctor_id || queueItem.doctor;
                      const doctor = sidebarDoctors.find(d => d.doctor_id === doctorId);

                      // 문진표 상태에 따른 스타일 및 텍스트
                      const questionnaireStatus = queueItem.questionnaire_status || 'NOT_STARTED';

                      let questionnaireDisplay = '미작성';
                      if (questionnaireStatus === 'COMPLETED') {
                        questionnaireDisplay = '작성완료';
                      } else if (questionnaireStatus === 'IN_PROGRESS') {
                        questionnaireDisplay = '작성중';
                      }
                      let questionnaireBadgeStyle = {};

                      if (questionnaireStatus === 'COMPLETED') {
                        questionnaireBadgeStyle = { backgroundColor: '#4CAF50', color: 'white' };
                      } else if (questionnaireStatus === 'IN_PROGRESS') {
                        questionnaireBadgeStyle = { backgroundColor: '#FF9800', color: 'white' };
                      } else {
                        questionnaireBadgeStyle = { backgroundColor: '#9E9E9E', color: 'white' };
                      }

                      const handlePatientClick = () => {
                        // 환자 작업 선택 모달 열기
                        setSelectedWaitingPatient(queueItem);
                        setIsPatientActionModalOpen(true);
                      };

                      return (
                        <div
                          key={index}
                          className={styles.totalWaitingPatientCard}
                          onClick={handlePatientClick}
                          style={{ cursor: 'pointer' }}
                          title="클릭하여 문진표 작성/확인"
                        >
                          <div className={styles.patientMainInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75em', fontWeight: 'bold', color: '#52759C', minWidth: '24px' }}>
                                {index + 1}
                              </span>
                              <span style={{ fontSize: '1em', fontWeight: 'bold', color: '#000', whiteSpace: 'nowrap' }}>
                                {queueItem.patient_name || '이름 없음'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <span
                                className={styles.questionnaireBadge}
                                style={{
                                  fontSize: '0.7em',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  ...questionnaireBadgeStyle
                                }}
                              >
                                {questionnaireDisplay}
                              </span>
                              <span className={`${styles.statusTag} ${queueItem.encounter_status === 'IN_PROGRESS' ? styles.진료중 : styles.대기중}`} style={{ fontSize: '0.75em', whiteSpace: 'nowrap' }}>
                                {queueItem.encounter_status === 'IN_PROGRESS' ? '진료중' : '대기중'}
                              </span>
                            </div>
                          </div>
                          <div className={styles.patientDetailInfo}>
                            <div style={{ fontSize: '0.75em', color: '#555' }}>
                              환자ID: {queueItem.patient || 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#555' }}>
                              접수시간: {queueItem.created_at ? new Date(queueItem.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#555' }}>
                              배정의사: {doctor ? `${doctor.name} (${doctor.room_number || '미배정'}호)` : queueItem.doctor_name || '의사 정보 없음'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
              <span>환자 접수</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'appointments' ? styles.active : ''}`}
              onClick={() => handleTabClick('appointments')}
            >
              <span>예약관리</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'patients' ? styles.active : ''}`}
              onClick={() => handleTabClick('patients')}
            >
              <span>환자 관리</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.active : ''}`}
              onClick={() => handleTabClick('schedule')}
            >
              <span>일정 관리</span>
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
                <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z" fill="currentColor" />
              </svg>
            </button>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Notifications clicked')}
              title="알림"
            >
              <svg className={styles.bellIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor" />
              </svg>
            </button>
            <button
              className={styles.iconButton}
              onClick={handleLogout}
              title="로그아웃"
            >
              <svg className={styles.logoutIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className={styles.mainContent}>
          {activeTab === 'schedule' ? (
            <SchedulePage />
          ) : activeTab === 'appointments' ? (
            <AppointmentManagementPage />
          ) : activeTab === 'patients' ? (
            <PatientManagementPage />
          ) : (
            <div className={styles.mainLayout}>
              {/* 상단 영역 - 환자 검색 및 금일 예약 */}
              <div className={styles.topRow}>
                {/* 왼쪽 영역 - 환자 검색 및 등록 */}
                <div className={styles.leftSection}>
                  <div className={styles.contentContainer}>
                    {/* 컨텐츠 탭 */}
                    <div className={styles.contentTabs}>
                      <button
                        className={`${styles.contentTab} ${contentTab === 'search' ? styles.active : ''}`}
                        onClick={() => setContentTab('search')}
                      >
                        검색
                      </button>
                      <button
                        className={`${styles.contentTab} ${contentTab === 'newPatient' ? styles.active : ''}`}
                        onClick={() => setContentTab('newPatient')}
                      >
                        신규 환자
                      </button>
                      <button
                        className={`${styles.contentTab} ${contentTab === 'appointments' ? styles.active : ''}`}
                        onClick={() => setContentTab('appointments')}
                      >
                        금일 예약
                      </button>
                    </div>

                    {contentTab === 'search' ? (
                      <div className={styles.contentBody}>
                        {/* 환자 검색 섹션 */}
                        <div className={styles.searchSection}>
                          <div className={styles.searchBar}>
                            <input
                              type="text"
                              placeholder="이름, 환자 ID, 생년월일 검색"
                              className={styles.searchInput}
                              value={searchQuery}
                              onChange={(e) => handleSearchChange(e.target.value)}
                            />
                            <button
                              className={styles.searchButton}
                              onClick={() => fetchPatients()}
                            >
                              검색
                            </button>
                          </div>

                          {/* 환자 목록 테이블 */}
                          <div className={styles.tableContainer}>
                            {isLoadingPatients ? (
                              <div style={{ textAlign: 'center', padding: '20px' }}>환자 목록 로딩 중...</div>
                            ) : (
                              <table className={styles.patientTable}>
                                <thead>
                                  <tr>
                                    <th>이름</th>
                                    <th>생년월일</th>
                                    <th>성별</th>
                                    <th>나이</th>
                                    <th>최근 방문</th>
                                    <th>작업</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {patients.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                                        등록된 환자가 없습니다.
                                      </td>
                                    </tr>
                                  ) : (
                                    currentPatients.map((patient) => {
                                      const isWaiting = waitingPatientIds.includes(patient.id);
                                      return (
                                        <tr key={patient.id}>
                                          <td
                                            className={styles.patientNameClickable}
                                            onClick={() => handlePatientClick(patient)}
                                            style={{ cursor: 'pointer' }}
                                          >
                                            {patient.name}
                                          </td>
                                          <td>{patient.birthDate}</td>
                                          <td>{patient.gender}</td>
                                          <td>{patient.age}세</td>
                                          <td>{patient.lastVisit}</td>
                                          <td>
                                            <div className={styles.actionButtons}>
                                              {isWaiting ? (
                                                <span className={styles.alreadyCheckedIn}>접수 완료</span>
                                              ) : (
                                                <button
                                                  className={styles.checkinBtn}
                                                  title="현장 접수"
                                                  onClick={() => handleCheckinClick(patient)}
                                                >
                                                  현장 접수
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* 페이지네이션 */}
                          {patients.length > 0 && (
                            <div className={styles.pagination}>
                              <button
                                className={styles.pageButton}
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                              >
                                이전
                              </button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                                <button
                                  key={pageNumber}
                                  className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ''}`}
                                  onClick={() => handlePageChange(pageNumber)}
                                >
                                  {pageNumber}
                                </button>
                              ))}
                              <button
                                className={styles.pageButton}
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                              >
                                다음
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : contentTab === 'newPatient' ? (
                      <div className={styles.contentBody}>
                        {/* 신규 환자 등록 폼 - 컴포넌트로 분리 */}
                        <PatientRegistrationForm
                          onSubmit={handlePatientRegistrationSubmit}
                          onCancel={() => setContentTab('search')}
                        />
                      </div>
                    ) : (
                      <div className={styles.contentBody}>
                        <div className={`${styles.appointmentContainer} ${styles.tabAppointmentContainer}`}>
                          <div className={styles.sectionHeader}>
                            <h3 className={styles.sectionTitle}>
                              금일 예약 {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
                            </h3>
                            <span className={styles.currentTime}>
                              {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div className={styles.tableContainer}>
                            <table className={styles.scheduleTable}>
                              <thead>
                                <tr>
                                  <th>요청일시</th>
                                  <th>환자명</th>
                                  <th>환자번호</th>
                                  <th>연락처</th>
                                  <th>희망일시</th>
                                  <th>상태</th>
                                </tr>
                              </thead>
                              <tbody>
                                {appointments.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                                      금일 예약이 없습니다.
                                    </td>
                                  </tr>
                                ) : (
                                  appointments.map((appointment) => (
                                    <tr
                                      key={appointment.id}
                                      onClick={() => {
                                        setSelectedAppointment(appointment);
                                        setIsAppointmentModalOpen(true);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                      className={styles.appointmentRow}
                                    >
                                      <td>{appointment.createdAt ? new Date(appointment.createdAt).toLocaleString('ko-KR') : 'N/A'}</td>
                                      <td className={styles.patientName}>{appointment.patientName}</td>
                                      <td>{appointment.patientId}</td>
                                      <td>{appointment.phone}</td>
                                      <td>{appointment.appointmentDate} {appointment.time}</td>
                                      <td>
                                        <span className={`${styles.appointmentStatus} ${styles[appointment.status]}`}>
                                          {appointment.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 오른쪽 영역 - 접수 목록 */}
                <div className={styles.rightSection}>
                  <div className={styles.appointmentContainer}>
                    <div className={styles.rightTabs}>
                      <button
                        className={`${styles.rightTab} ${receptionTab === 'reception' ? styles.rightTabActive : ''}`}
                        onClick={() => setReceptionTab('reception')}
                      >
                        오더 대기
                      </button>
                      <button
                        className={`${styles.rightTab} ${receptionTab === 'additional' ? styles.rightTabActive : ''}`}
                        onClick={() => setReceptionTab('additional')}
                      >
                        추가진료
                      </button>
                      <button
                        className={`${styles.rightTab} ${receptionTab === 'payment' ? styles.rightTabActive : ''}`}
                        onClick={() => setReceptionTab('payment')}
                      >
                        수납대기
                      </button>
                    </div>
                    <div className={styles.tableContainer}>
                      {receptionTab === 'reception' && (
                        <OrderList refreshTrigger={orderRefreshTrigger} />
                      )}

                      {receptionTab === 'additional' && (
                        <div style={{ padding: '10px' }}>
                          <div className={styles.sectionTitle} style={{ marginBottom: '10px', fontSize: '14px', color: '#555' }}>
                            추가 진료 대기 환자 (결과 대기)
                          </div>
                          {/* 추가 진료 대기 환자 목록 (WAITING_RESULTS) */}
                          {waitingQueueData?.queue?.filter((p: any) => p.encounter_status === 'WAITING_RESULTS').length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '14px' }}>
                              추가 진료가 필요한 환자가 없습니다.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {waitingQueueData?.queue
                                ?.filter((p: any) => p.encounter_status === 'WAITING_RESULTS')
                                .map((patient: any) => (
                                  <div
                                    key={patient.encounter_id}
                                    style={{
                                      padding: '12px',
                                      backgroundColor: '#FFF3E0',
                                      borderLeft: '4px solid #FF9800',
                                      borderRadius: '4px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{patient.patient_name} <span style={{ fontSize: '12px', color: '#666' }}>({patient.patient_id})</span></div>
                                      <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>
                                        {patient.doctor_name} ({patient.department_name})
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{
                                        fontSize: '12px',
                                        padding: '3px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: '#FFE0B2',
                                        color: '#EF6C00',
                                        fontWeight: 'bold'
                                      }}>결과대기</span>
                                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                        {patient.checkin_time ? new Date(patient.checkin_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      )}
                      {receptionTab === 'payment' && (
                        <div className={styles.emptyState}>수납대기 목록이 없습니다.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 진료실별 대기 현황 (상세) - 2행 전체 */}
              <div className={styles.detailedWaitingContainer}>
                <h3 className={styles.sectionTitle}>진료실별 대기 현황</h3>
                <div className={styles.waitingDetailCards}>
                  {clinicWaitingList.map((clinic) => {
                    const viewMode = clinicViewModes[clinic.id] || 'WAITING';
                    const isCompletedMode = viewMode === 'COMPLETED';

                    // 뷰 모드에 따라 환자 필터링
                    const filteredPatients = clinic.patients.filter(p => {
                      if (isCompletedMode) {
                        return p.status === '진료완료';
                      } else {
                        return p.status === '진료중' || p.status === '대기중';
                      }
                    });

                    return (
                      <div key={clinic.id} className={styles.waitingDetailCard}>
                        <div className={styles.cardHeader}>
                          <div className={styles.cardTitleSection}>
                            <span className={styles.cardTitle}>{clinic.roomNumber}</span>
                            <span style={{ fontSize: '0.9em', color: '#FFFFFF', marginLeft: '10px' }}>
                              {clinic.doctorName} ({clinic.clinicName})
                            </span>
                            <button
                              className={styles.cardButton}
                              onClick={() => toggleClinicViewMode(clinic.id)}
                            >
                              {isCompletedMode ? '진료완료' : '진료대기'}
                            </button>
                          </div>
                        </div>
                        <div className={styles.cardBody}>
                          {filteredPatients.length > 0 ? (
                            filteredPatients.map((patient, index) => (
                              <div
                                key={index}
                                className={styles.waitingPatientRow}
                                onClick={() => {
                                  if (isCompletedMode) {
                                    setSelectedEncounterId(patient.encounterId);
                                    setSelectedPatientNameForModal(patient.name);
                                    setIsEncounterModalOpen(true);
                                  }
                                }}
                                style={isCompletedMode ? { cursor: 'pointer', backgroundColor: '#f0fff4' } : {}}
                              >
                                <div className={styles.patientDetailRow}>
                                  <span className={styles.patientIndex}>{index + 1}</span>
                                  <span className={styles.patientNameLarge}>{patient.name}</span>
                                  <span className={styles.patientPhoneLarge}>{patient.phone}</span>
                                </div>
                                <div className={styles.patientActions}>
                                  <span
                                    className={`${styles.statusBadgeLarge}`}
                                    style={{
                                      backgroundColor: patient.status === '진료중' ? '#e74c3c' :
                                        patient.status === '진료완료' ? '#2ecc71' : '#f1c40f',
                                      color: 'white'
                                    }}
                                  >
                                    {patient.status}
                                  </span>
                                  {!isCompletedMode && (
                                    <button
                                      className={styles.cancelWaitingBtn}
                                      onClick={() => handleCancelWaiting(patient.encounterId, patient.name)}
                                      title="대기 취소"
                                    >
                                      취소
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className={styles.emptyWaiting}>
                              {isCompletedMode ? '완료된 진료가 없습니다' : '대기 환자가 없습니다'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 환자 상세 정보 모달 */}
      {isModalOpen && selectedPatient && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>환자 상세 정보</h2>
              <button className={styles.closeButton} onClick={handleCloseModal}>×</button>
            </div>

            {!isEditing ? (
              // 조회 모드
              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>환자 ID:</span>
                    <span className={styles.detailValue}>{selectedPatient.id}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>이름:</span>
                    <span className={styles.detailValue}>{selectedPatient.name}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>생년월일:</span>
                    <span className={styles.detailValue}>{selectedPatient.birthDate}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>성별:</span>
                    <span className={styles.detailValue}>{selectedPatient.gender}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>나이:</span>
                    <span className={styles.detailValue}>{selectedPatient.age}세</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>전화번호:</span>
                    <span className={styles.detailValue}>{selectedPatient.phone || 'N/A'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>등록일:</span>
                    <span className={styles.detailValue}>{selectedPatient.registrationDate}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>최근 방문:</span>
                    <span className={styles.detailValue}>{selectedPatient.lastVisit}</span>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button className={styles.editButton} onClick={handleEditToggle}>
                    수정
                  </button>
                  <button className={styles.cancelButton} onClick={handleCloseModal}>
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              // 수정 모드
              <form className={styles.modalBody} onSubmit={handleUpdatePatient}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>환자 ID</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={selectedPatient.id}
                      disabled
                      style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>이름 <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={editForm.name}
                      onChange={(e) => handleEditFormChange('name', e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>생년월일 <span className={styles.required}>*</span></label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={editForm.date_of_birth}
                      onChange={(e) => handleEditFormChange('date_of_birth', e.target.value)}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>성별 <span className={styles.required}>*</span></label>
                    <select
                      className={styles.formInput}
                      value={editForm.gender}
                      onChange={(e) => handleEditFormChange('gender', e.target.value)}
                      required
                    >
                      <option value="">선택</option>
                      <option value="M">남</option>
                      <option value="F">여</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>전화번호</label>
                    <input
                      type="tel"
                      className={styles.formInput}
                      placeholder="010-0000-0000"
                      value={editForm.phone}
                      onChange={(e) => handleEditFormChange('phone', e.target.value)}
                    />
                  </div>


                </div>

                <div className={styles.modalActions}>
                  <button type="submit" className={styles.submitButton}>
                    저장
                  </button>
                  <button type="button" className={styles.cancelButton} onClick={handleEditToggle}>
                    취소
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 현장 접수 모달 - 컴포넌트로 분리 */}
      <CheckinModal
        isOpen={isCheckinModalOpen}
        patient={checkinPatient}
        doctors={sidebarDoctors}
        onClose={() => setIsCheckinModalOpen(false)}
        onSubmit={handleCheckinSubmit}
      />

      {/* 예약 승인 모달 */}
      {isAppointmentModalOpen && selectedAppointment && (
        <div className={styles.modalOverlay} onClick={() => setIsAppointmentModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>예약 승인</h2>
              <button className={styles.closeButton} onClick={() => setIsAppointmentModalOpen(false)}>×</button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>예약 정보</h3>
                <p style={{ margin: '5px 0' }}><strong>환자명:</strong> {selectedAppointment.patientName}</p>
                <p style={{ margin: '5px 0' }}><strong>환자번호:</strong> {selectedAppointment.patientId}</p>
                <p style={{ margin: '5px 0' }}><strong>생년월일:</strong> {selectedAppointment.phone}</p>
                <p style={{ margin: '5px 0' }}><strong>희망일시:</strong> {selectedAppointment.appointmentDate} {selectedAppointment.time}</p>
                <p style={{ margin: '5px 0' }}><strong>증상/내용:</strong> {selectedAppointment.consultationType}</p>
                <p style={{ margin: '5px 0' }}><strong>상태:</strong> {selectedAppointment.status}</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>담당 의사 배정 <span className={styles.required}>*</span></label>
                <select
                  className={styles.formInput}
                  value={appointmentDoctor || ''}
                  onChange={(e) => setAppointmentDoctor(Number(e.target.value))}
                  required
                  style={{ fontSize: '15px' }}
                >
                  <option value="">의사를 선택하세요</option>
                  {sidebarDoctors.map((doctor: any) => (
                    <option key={doctor.doctor_id} value={doctor.doctor_id}>
                      [{doctor.department.dept_name}] {doctor.name}
                      {doctor.room_number ? ` (${doctor.room_number}호)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {appointmentDoctor && (
                <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '8px', fontSize: '14px' }}>
                  <strong>ℹ️ 안내:</strong> 선택한 의사의 스케줄에 예약이 배정됩니다.
                </div>
              )}

              <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={async () => {
                    if (!appointmentDoctor) {
                      alert('담당 의사를 선택해주세요.');
                      return;
                    }

                    try {
                      await updateAppointment(selectedAppointment.appointmentId!, {
                        doctor: appointmentDoctor,
                        status: '승인완료'
                      });

                      alert('예약이 승인되었습니다.');
                      setIsAppointmentModalOpen(false);
                      setSelectedAppointment(null);
                      setAppointmentDoctor(null);

                      // 예약 목록 새로고침
                      await fetchTodayAppointments();
                    } catch (error: any) {
                      console.error('예약 승인 실패:', error);
                      alert(error.response?.data?.message || '예약 승인에 실패했습니다.');
                    }
                  }}
                  disabled={!appointmentDoctor}
                  style={{ opacity: !appointmentDoctor ? 0.5 : 1 }}
                >
                  승인
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsAppointmentModalOpen(false);
                    setSelectedAppointment(null);
                    setAppointmentDoctor(null);
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 환자 작업 선택 모달 */}
      <PatientActionModal
        isOpen={isPatientActionModalOpen}
        patient={selectedWaitingPatient ? {
          id: selectedWaitingPatient.patient || selectedWaitingPatient.patient_id,
          name: selectedWaitingPatient.patient_name || '이름 없음',
          patientId: selectedWaitingPatient.patient || selectedWaitingPatient.patient_id,
          birthDate: selectedWaitingPatient.date_of_birth || undefined,
          gender: selectedWaitingPatient.gender === 'M' ? '남' : selectedWaitingPatient.gender === 'F' ? '여' : undefined,
          phone: selectedWaitingPatient.phone || undefined,
          registrationTime: selectedWaitingPatient.created_at,
          encounterId: selectedWaitingPatient.encounter_id,
          questionnaireStatus: selectedWaitingPatient.questionnaire_status
        } : null}
        onClose={() => {
          setIsPatientActionModalOpen(false);
          setSelectedWaitingPatient(null);
        }}
        onQuestionnaireAction={handleOpenQuestionnaireFromAction}
      />

      {/* 문진표 작성 모달 */}
      <QuestionnaireModal
        isOpen={isQuestionnaireModalOpen}
        patient={questionnairePatient}
        initialData={questionnaireInitialData}
        onClose={() => {
          setIsQuestionnaireModalOpen(false);
          setQuestionnairePatient(null);
          setQuestionnaireInitialData(null);
        }}
        onSubmit={handleQuestionnaireSubmit}
        onDelete={questionnaireInitialData ? handleQuestionnaireDelete : undefined}
      />

      {/* 진료 기록 상세 모달 (Administration용) */}
      <EncounterDetailModal
        isOpen={isEncounterModalOpen}
        encounterId={selectedEncounterId}
        patientName={selectedPatientNameForModal}
        onClose={() => {
          setIsEncounterModalOpen(false);
          setSelectedEncounterId(null);
        }}
      />

      {/* 진료 기록 상세 모달 (Administration용) */}
      <EncounterDetailModal
        isOpen={isEncounterModalOpen}
        encounterId={selectedEncounterId}
        patientName={selectedPatientNameForModal}
        onClose={() => {
          setIsEncounterModalOpen(false);
          setSelectedEncounterId(null);
        }}
      />
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#333',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '8px',
          zIndex: 9999,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>알림</div>
          <div>{notification.message}</div>
        </div>
      )}
    </div>
  );
}
