import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { useWebSocketContext } from "../../context/WebSocketContext";
import { useWaitingQueue } from "../../hooks/useWaitingQueue";
import { useDashboardStats } from "../../hooks/useDashboardStats";
import { useDoctors } from "../../hooks/useDoctors";
import { useAdministrationData } from "../../contexts/AdministrationContext";
import { usePatients } from "../../hooks/usePatients";
import {
  registerPatient,
  getPatientDetail,
  updatePatient,
  getAppSyncRequests,
  approveAppSyncRequest,
  rejectAppSyncRequest,
  getStaffList,
  getAdministrationWaitingQueue,
  type PatientRegistrationData,
  type PatientUpdateData,
  type AppSyncRequest
} from "../../api/hospitalOpsApi";
import {
  getAdministrationDashboard,
  getWaitingQueue,
  getEncounters,
  createEncounter,
  getAppointments,
  getAppointmentDetail,
  createAppointment,
  updateAppointment,
  cancelEncounter,
  updateEncounter,
  createQuestionnaire
} from "../../api/receptionApi";
import styles from './Dashboard.module.css';

import CheckinModal from '../../components/administration/CheckinModal';
import PatientSearchPanel from '../../components/administration/PatientSearchPanel';
import PatientRegistrationForm from '../../components/administration/PatientRegistrationForm';
import PatientDetailModal from '../../components/administration/PatientDetailModal';
import QuestionnaireModal, { type QuestionnaireData } from '../../components/administration/QuestionnaireModal';
// PatientActionModal Removed (Only used in Sidebar)
import EncounterDetailModal from '../../components/administration/EncounterDetailModal';
import OrderList from '../../components/administration/OrderList';
import VitalMeasurementModal, { type VitalOrPhysicalData } from '../../components/administration/VitalMeasurementModal';
import { submitVitalOrPhysicalData, type PendingOrder, getInProgressOrders } from '../../api/hospitalOpsApi';
import UnifiedQueueList from '../../components/administration/UnifiedQueueList';

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
    status: string;
    patientId: string;
    encounter_status: string;
  }[];
}


type TabType = 'home' | 'schedule' | 'appointments' | 'patients';
type ContentTabType = 'search' | 'newPatient' | 'appointments';
type ReceptionTabType = 'reception' | 'testWaiting' | 'additional' | 'payment' | 'appSync';

export default function AdministrationDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Local state for dashboard tabs
  const [contentTab, setContentTab] = useState<ContentTabType>('search');
  const [receptionTab, setReceptionTab] = useState<ReceptionTabType>('reception');

  const [additionalPage, setAdditionalPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const itemsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState('');
  const [adminStaffId, setAdminStaffId] = useState<number | null>(null);
  const { lastMessage } = useWebSocketContext();

  // Custom Hook for Patients
  const { patients, fetchPatients, isLoading: isLoadingPatients, currentPage, setCurrentPage, totalPages } = usePatients();
  const patientsPerPage = 5;

  // Context Data
  const {
    waitingQueueData: queueData,
    waitingQueueData,
    dashboardStats,
    fetchDashboardStats,
    doctors: sidebarDoctors,
    fetchDoctors,
    refreshPatientsTrigger,
    fetchWaitingQueue,
    isLoadingQueue // Added loading state
  } = useAdministrationData();

  // 영상의학과 대기열 상태
  const [imagingQueueData, setImagingQueueData] = useState<any>(null);

  // 영상의학과 대기열 가져오기
  const fetchImagingQueue = async () => {
    try {
      const response = await fetch('/api/administration/queue/admin/?type=imaging', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setImagingQueueData(data);
    } catch (error) {
      console.error('Failed to fetch imaging queue:', error);
    }
  };

  // Refresh trigger listener
  useEffect(() => {
    if (currentPage === 1) {
      fetchPatients(searchQuery, 1);
    }
  }, [refreshPatientsTrigger]); // searchQuery changes handled manually

  // 영상의학과 대기열 초기 로드 및 WebSocket 업데이트
  useEffect(() => {
    fetchImagingQueue();
  }, []);

  // WebSocket 업데이트 시 영상의학과 대기열 갱신
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'queue_update') {
      const queueType = lastMessage.data?.queue_type;
      if (queueType === 'imaging') {
        fetchImagingQueue();
      }
    }
  }, [lastMessage]);

  // --- Modals State ---
  // Patient Detail Modal
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Checkin Modal
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinPatient, setCheckinPatient] = useState<Patient | null>(null);

  // Questionnaire Modal
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [questionnairePatient, setQuestionnairePatient] = useState<Patient | null>(null);
  const [lastEncounterId, setLastEncounterId] = useState<number | null>(null);
  const [questionnaireInitialData, setQuestionnaireInitialData] = useState<QuestionnaireData | null>(null);

  // Encounter Detail Modal
  const [isEncounterModalOpen, setIsEncounterModalOpen] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(null);
  const [selectedPatientNameForModal, setSelectedPatientNameForModal] = useState<string>('');

  // Vital/Physical Modal
  const [isVitalCheckModalOpen, setIsVitalCheckModalOpen] = useState(false);
  const [selectedVitalOrder, setSelectedVitalOrder] = useState<PendingOrder | null>(null);
  const [isLastVitalOrder, setIsLastVitalOrder] = useState(false);
  const [hasCTOrderForVital, setHasCTOrderForVital] = useState(false);

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentPatient, setSelectedPaymentPatient] = useState<any>(null);

  // Appointment Modal
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentDoctor, setAppointmentDoctor] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [radiologyStaff, setRadiologyStaff] = useState<any[]>([]);

  // Clinic Waiting Detail View Mode
  const [clinicViewModes, setClinicViewModes] = useState<Record<number, 'WAITING' | 'COMPLETED'>>({});

  // App Sync
  const [appSyncRequests, setAppSyncRequests] = useState<AppSyncRequest[]>([]);
  const [isAppSyncLoading, setIsAppSyncLoading] = useState(false);
  const [appSyncError, setAppSyncError] = useState<string | null>(null);
  const [appSyncRefreshKey, setAppSyncRefreshKey] = useState(0);

  // Notification
  const [orderRefreshTrigger, setOrderRefreshTrigger] = useState(0);
  const [notification, setNotification] = useState<{ message: string, type: string } | null>(null);



  useEffect(() => {
    if (lastMessage && lastMessage.type === 'new_order') {
      const msg = lastMessage.message || '새로운 오더가 도착했습니다.';
      setNotification({ message: msg, type: 'info' });
      setOrderRefreshTrigger(prev => prev + 1);
      setTimeout(() => setNotification(null), 3000);
    }
  }, [lastMessage]);

  const toggleClinicViewMode = (doctorId: number) => {
    setClinicViewModes(prev => ({
      ...prev,
      [doctorId]: prev[doctorId] === 'COMPLETED' ? 'WAITING' : 'COMPLETED'
    }));
  };

  // --- Logic for Detailed Waiting Status ---
  const clinicWaitingList = useMemo((): ClinicWaiting[] => {
    const result: ClinicWaiting[] = [];

    // 의사 진료실 목록
    if (sidebarDoctors.length > 0) {
      const parseRoomNumber = (room?: string) => {
        if (!room) return Number.POSITIVE_INFINITY;
        const numeric = Number.parseInt(room.replace(/\D/g, ''), 10);
        return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
      };

      const sortedDoctors = [...sidebarDoctors].sort((a, b) => {
        const aRoom = parseRoomNumber(a.room_number);
        const bRoom = parseRoomNumber(b.room_number);
        if (aRoom !== bRoom) return aRoom - bRoom;
        return a.name.localeCompare(b.name);
      });

      sortedDoctors.forEach((doctor) => {
        const myPatients = waitingQueueData?.queue?.filter((q: any) => {
          const docId = Number(doctor.doctor_id);
          const qDocId = q.doctor_id ? Number(q.doctor_id) : null;
          const qDoc = q.doctor ? Number(q.doctor) : null;
          const qAssignedDoc = q.assigned_doctor ? Number(q.assigned_doctor) : null;
          return qDocId === docId || qDoc === docId || qAssignedDoc === docId;
        }) || [];

        const formattedPatients = myPatients
          .filter((p: any) => ['WAITING_CLINIC', 'IN_CLINIC', 'WAITING_RESULTS', 'COMPLETED'].includes(p.workflow_state))
          .map((p: any) => {
            let statusText = '대기중';
            if (p.workflow_state === 'IN_CLINIC') statusText = '진료중';
            else if (p.workflow_state === 'WAITING_RESULTS') statusText = '결과대기';
            else if (p.workflow_state === 'COMPLETED') statusText = '진료완료';

            const gender = p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : p.gender;
            const patientInfo = `${p.date_of_birth || 'N/A'} | ${p.age || 0}세 | ${gender}`;

            return {
              encounterId: p.encounter_id,
              name: p.patient_name || 'Unknown',
              phone: patientInfo,
              status: statusText,
              patientId: p.patient || p.patient_id,
              encounter_status: p.workflow_state,
              checkin_time: p.checkin_time
            };
          })
          .sort((a: any, b: any) => {
            if (a.encounter_status === 'IN_CLINIC' && b.encounter_status !== 'IN_CLINIC') return -1;
            if (a.encounter_status !== 'IN_CLINIC' && b.encounter_status === 'IN_CLINIC') return 1;
            return 0;
          });

        result.push({
          id: doctor.doctor_id,
          clinicName: doctor.department.dept_name,
          roomNumber: doctor.room_number ? `${doctor.room_number}` : 'Unassigned',
          doctorName: doctor.name,
          patients: formattedPatients
        });
      });
    }

    // 영상의학과 (CT실) 추가
    if (imagingQueueData?.queue) {
      const primaryRadiologist = radiologyStaff[0];
      const radiologyName = primaryRadiologist?.name || 'Radiology';
      const radiologyDept = primaryRadiologist?.dept_name || 'Radiology';
      const radiologyId = primaryRadiologist?.user_id ?? -1;
      const extraCount = radiologyStaff.length > 1 ? ` +${radiologyStaff.length - 1}` : '';
      const radiologyDisplayName = `${radiologyName}${extraCount}`;

      const imagingPatients = imagingQueueData.queue
        .map((p: any) => {
          let statusText = '대기중';
          if (p.workflow_state === 'IN_IMAGING') statusText = '촬영중';
          else if (p.workflow_state === 'WAITING_IMAGING') statusText = '대기중';
          else if (p.workflow_state === 'COMPLETED') statusText = '완료';

          const gender = p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : p.gender;
          const patientInfo = `${p.date_of_birth || 'N/A'} | ${p.age || 0}세 | ${gender}`;

          return {
            encounterId: p.encounter_id,
            name: p.patient_name || 'Unknown',
            phone: patientInfo,
            status: statusText,
            patientId: p.patient || p.patient_id,
            encounter_status: p.workflow_state,
            checkin_time: p.state_entered_at
          };
        })
        .sort((a: any, b: any) => {
          if (a.encounter_status === 'IN_IMAGING' && b.encounter_status !== 'IN_IMAGING') return -1;
          if (a.encounter_status !== 'IN_IMAGING' && b.encounter_status === 'IN_IMAGING') return 1;
          return 0;
        });

      result.push({
        id: radiologyId,
        clinicName: radiologyDept,
        roomNumber: 'CT',
        doctorName: radiologyDisplayName,
        patients: imagingPatients
      });
    }

    return result;
  }, [sidebarDoctors, waitingQueueData, imagingQueueData, radiologyStaff]);

  const waitingPatientIds = useMemo(() => {
    if (!waitingQueueData?.queue) return [];
    return waitingQueueData.queue
      .filter((q: any) => q.workflow_state !== 'COMPLETED')
      .map((q: any) => q.patient_id || q.patient)
      .filter(Boolean);
  }, [waitingQueueData]);

  const additionalPatients = useMemo(() => {
    return waitingQueueData?.queue?.filter((p: any) => p.workflow_state === 'WAITING_CLINIC' && p.is_returning_patient) || [];
  }, [waitingQueueData]);

  const paymentPatients = useMemo(() => {
    return waitingQueueData?.queue?.filter((p: any) => p.workflow_state === 'WAITING_PAYMENT') || [];
  }, [waitingQueueData]);

  // --- API Calls ---

  const fetchTodayAppointments = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await getAppointments({ date: today });

      const formattedAppointments: Appointment[] = data.results.map((apt: any) => ({
        id: apt.appointment_id,
        time: `${apt.appointment_time || 'N/A'}`,
        patientName: apt.patient_name || '이름 없음',
        phone: apt.patient?.date_of_birth || 'N/A',
        doctor: apt.doctor_name || '미배정',
        consultationType: apt.notes || apt.appointment_type || '일반 진료',
        status: apt.status || '예약완료',
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

  const fetchAppSyncRequests = useCallback(async () => {
    setIsAppSyncLoading(true);
    setAppSyncError(null);
    try {
      const response = await getAppSyncRequests('PENDING');
      setAppSyncRequests(response.results || []);
    } catch (error) {
      console.error('앱 연동 신청 목록 조회 실패:', error);
      setAppSyncError('앱 연동 신청 인원이 없습니다.');
    } finally {
      setIsAppSyncLoading(false);
    }
  }, []);

  const fetchRadiologyStaff = useCallback(async () => {
    try {
      const staffList = await getStaffList();
      const radiologists = (staffList || []).filter((staff: any) => staff.role === 'RADIOLOGIST');
      setRadiologyStaff(radiologists);
    } catch (error) {
      console.error('Failed to fetch radiology staff:', error);
    }
  }, []);


  useEffect(() => {
    const storedAdmin = localStorage.getItem('administration');
    if (storedAdmin) {
      try {
        const adminStaff = JSON.parse(storedAdmin);
        if (typeof adminStaff.staff_id === 'number') {
          setAdminStaffId(adminStaff.staff_id);
        }
      } catch (error) { console.error(error); }
    }

    // Initial Loads (Doctors, Queue done by Context usually, but Appointments local)
    fetchTodayAppointments();
    fetchRadiologyStaff();
  }, [fetchTodayAppointments, fetchRadiologyStaff]);

  useEffect(() => {
    if (receptionTab === 'appSync') {
      fetchAppSyncRequests();
    }
  }, [receptionTab, fetchAppSyncRequests, appSyncRefreshKey]);

  // --- Handlers ---

  const handleApproveAppSync = async (request: AppSyncRequest) => {
    try {
      await approveAppSyncRequest(request.request_id, undefined, adminStaffId ?? undefined);
      setAppSyncRequests((prev) => prev.filter((item) => item.request_id !== request.request_id));
      setAppSyncRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('앱 연동 승인 실패:', error);
      alert(error.response?.data?.message || '앱 연동 승인에 실패했습니다.');
    }
  };

  const handleRejectAppSync = async (request: AppSyncRequest) => {
    if (!window.confirm('이 연동 신청을 거절하시겠습니까?')) return;
    try {
      await rejectAppSyncRequest(request.request_id, adminStaffId ?? undefined);
      setAppSyncRequests((prev) => prev.filter((item) => item.request_id !== request.request_id));
      setAppSyncRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error('앱 연동 거절 실패:', error);
      alert(error.response?.data?.message || '앱 연동 거절에 실패했습니다.');
    }
  };

  const handlePatientRegistrationSubmit = async (data: PatientRegistrationData) => {
    const response = await registerPatient(data);
    alert(`환자 등록 완료: ${response.patient.name} (${response.patient.patient_id})`);
    setContentTab('search');
    fetchPatients();
    return response;
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    fetchPatients(value, 1);
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    fetchPatients(searchQuery, pageNumber);
  };

  const handlePatientClick = async (patient: Patient) => {
    try {
      const detailData = await getPatientDetail(patient.id.toString());
      setSelectedPatient({ ...patient, ...detailData });
      setIsModalOpen(true);
      setIsEditing(false);
    } catch (error) {
      console.error('환자 상세 정보 조회 실패:', error);
      alert('환자 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleCloseModal = () => { setIsModalOpen(false); setSelectedPatient(null); setIsEditing(false); };
  const handleEditToggle = () => setIsEditing(true); // 수정 모드 진입
  const handleCancelEdit = () => setIsEditing(false); // 수정 취소

  const handleUpdatePatient = async (data: any) => {
    if (!selectedPatient) return;
    try {
      const updateData: PatientUpdateData = {
        name: data.name,
        date_of_birth: data.date_of_birth,
        gender: data.gender as 'M' | 'F',
        phone: data.phone || undefined,
      };
      await updatePatient(selectedPatient.id.toString(), updateData);
      setSelectedPatient({
        ...selectedPatient,
        name: data.name,
        birthDate: data.date_of_birth,
        gender: data.gender === 'M' ? '남' : data.gender === 'F' ? '여' : 'N/A',
        phone: data.phone || 'N/A',
      });
      setIsEditing(false);
      alert('환자 정보가 수정되었습니다.');
      await fetchPatients();
    } catch (error: any) {
      console.error('환자 정보 수정 실패:', error);
      alert('환자 정보 수정에 실패했습니다.');
    }
  };

  const handleCheckinClick = async (patient: Patient) => {
    try {
      setCheckinPatient(patient);
      await fetchDoctors();
      setIsCheckinModalOpen(true);
    } catch (error) {
      console.error('의사 목록 조회 실패:', error);
      alert('의사 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleCheckinSubmit = async (patientId: string, doctorId: number) => {
    try {
      const now = new Date();
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
      const encounterId = response.encounter?.encounter_id || response.encounter_id;
      setLastEncounterId(encounterId);
      setIsCheckinModalOpen(false);

      Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);

      if (window.confirm('접수가 완료되었습니다.\n문진표를 작성하시겠습니까?')) {
        setQuestionnairePatient(checkinPatient);
        setIsQuestionnaireModalOpen(true);
      }
    } catch (error: any) {
      console.error('접수 처리 실패:', error);
      alert(error.response?.data?.message || '접수 처리 중 오류가 발생했습니다.');
    }
  };

  const handleCancelWaiting = async (encounterId: number, patientName: string, workflowState: string) => {
    if (workflowState === 'IN_CLINIC') return alert('진료 중인 환자는 취소할 수 없습니다.');
    if (!window.confirm(`${patientName} 환자의 대기를 취소하시겠습니까?`)) return;
    try {
      await cancelEncounter(encounterId);
      alert('대기가 취소되었습니다.');
      await Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || '오류 발생');
    }
  };

  const handleQuestionnaireSubmit = async (data: QuestionnaireData) => {
    try {
      if (lastEncounterId) {
        await updateEncounter(lastEncounterId, { questionnaire_data: data, questionnaire_status: 'COMPLETED' });
        alert('문진표가 제출되었습니다.');
      } else {
        await createQuestionnaire(data);
        alert('문진표가 제출되었습니다.');
      }
      Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);
      setIsQuestionnaireModalOpen(false);
      setQuestionnairePatient(null);
      setLastEncounterId(null);
    } catch (error: any) {
      console.error('문진표 제출 실패:', error);
      alert(error.response?.data?.message || '문진표 제출 중 오류가 발생했습니다.');
    }
  };

  const handleQuestionnaireDelete = async () => {
    try {
      if (lastEncounterId) {
        await updateEncounter(lastEncounterId, { questionnaire_data: null, questionnaire_status: 'NOT_STARTED' });
        alert('문진표가 삭제되었습니다.');
        Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);
        setIsQuestionnaireModalOpen(false);
        setQuestionnairePatient(null);
        setLastEncounterId(null);
      }
    } catch (error: any) {
      console.error('문진표 삭제 실패:', error);
    }
  };

  const handleOpenVitalCheckModal = (order: PendingOrder, isLastOrder: boolean = false, hasCTOrder: boolean = false) => {
    setSelectedVitalOrder(order);
    setIsLastVitalOrder(isLastOrder);
    setHasCTOrderForVital(hasCTOrder);
    setIsVitalCheckModalOpen(true);
  };

  const handleVitalCheckSubmit = async (data: VitalOrPhysicalData) => {
    if (!selectedVitalOrder) return;
    try {
      const orderType = selectedVitalOrder.order_type as 'VITAL' | 'PHYSICAL';
      await submitVitalOrPhysicalData(selectedVitalOrder.id, orderType, data);
      const encounterId = selectedVitalOrder.encounter_id;

      if (!isLastVitalOrder) {
        // 마지막 오더가 아님 → 다음 오더 진행
        alert('검사 데이터가 저장되었습니다. 다음 오더를 진행해주세요.');
      } else if (hasCTOrderForVital) {
        // CT 오더가 있음 → 백엔드에서 자동으로 WAITING_IMAGING 처리하므로 선택 안 물어봄
        alert('검사 데이터가 저장되었습니다. 환자가 CT 대기열로 이동합니다.');
      } else if (encounterId) {
        // CT 오더 없고 마지막 오더 → 수납/추가진료 선택
        if (window.confirm('모든 오더가 처리되었습니다.\n환자를 수납(귀가) 대기로 이동시키겠습니까?')) {
          await updateEncounter(encounterId, { workflow_state: 'WAITING_PAYMENT' });
          alert('환자가 수납 대기 상태로 이동되었습니다.');
        } else if (window.confirm('그럼 환자를 진료실 대기(추가 진료)로 이동시키겠습니까?')) {
          await updateEncounter(encounterId, { workflow_state: 'WAITING_CLINIC' });
          alert('환자가 진료 대기 상태로 이동되었습니다.');
        } else {
          alert('검사 데이터가 저장되었습니다.');
        }
      } else {
        alert('검사 데이터가 저장되었습니다.');
      }
      setIsVitalCheckModalOpen(false);
      setSelectedVitalOrder(null);
      setIsLastVitalOrder(false);
      setHasCTOrderForVital(false);
      setOrderRefreshTrigger(prev => prev + 1);
      fetchWaitingQueue();
      fetchDashboardStats();
    } catch (error: any) {
      console.error('검사 데이터 제출 실패:', error);
      alert(error.response?.data?.message || '검사 데이터 제출 중 오류가 발생했습니다.');
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentPatient) return;
    if (!window.confirm(`${selectedPaymentPatient.patient_name} 환자의 결제를 진행하시겠습니까?`)) return;
    try {
      await updateEncounter(selectedPaymentPatient.encounter_id, { workflow_state: 'COMPLETED' });
      alert('수납이 완료되었습니다.');
      setIsPaymentModalOpen(false);
      setSelectedPaymentPatient(null);
      fetchWaitingQueue();
      fetchDashboardStats();
    } catch (error: any) {
      console.error('수납 처리 실패:', error);
      alert(error.response?.data?.message || '수납 처리 중 오류가 발생했습니다.');
    }
  };



  return (
    <>
      <div className={styles.mainLayout}>
        {/* 상단 영역 - 환자 검색 및 금일 예약 */}
        <div className={styles.topRow}>
          {/* 왼쪽 영역 - 환자 검색 및 등록 */}
          <div className={styles.leftSection}>
            <div className={styles.contentContainer}>
              {/* 컨텐츠 탭 */}
              <div className={styles.contentTabs}>
                <button className={`${styles.contentTab} ${contentTab === 'search' ? styles.active : ''}`} onClick={() => setContentTab('search')}>검색</button>
                <button className={`${styles.contentTab} ${contentTab === 'newPatient' ? styles.active : ''}`} onClick={() => setContentTab('newPatient')}>신규 환자</button>
                <button className={`${styles.contentTab} ${contentTab === 'appointments' ? styles.active : ''}`} onClick={() => setContentTab('appointments')}>금일 예약</button>
              </div>

              {contentTab === 'search' ? (
                <div className={styles.contentBody}>
                  <div className={styles.searchSection}>
                    <div className={styles.searchBar}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input type="text" placeholder="이름, 환자 ID, 생년월일 검색" className={styles.searchInput} value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} style={{ paddingRight: '30px', width: '100%' }} />
                        {searchQuery && (<button onClick={() => handleSearchChange('')} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>)}
                      </div>
                      <button className={styles.searchButton} onClick={() => fetchPatients(searchQuery, 1)}>검색</button>
                    </div>

                    <div className={styles.tableContainer}>
                      {isLoadingPatients ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>환자 목록 로딩 중...</div>
                      ) : (
                        <table className={styles.patientTable}>
                          <thead>
                            <tr>
                              <th>이름</th><th>생년월일</th><th>성별</th><th>나이</th><th>최근 방문</th><th>작업</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patients.length === 0 ? (
                              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>등록된 환자가 없습니다.</td></tr>
                            ) : (
                              patients.map((patient) => {
                                const isWaiting = waitingPatientIds.includes(patient.id);
                                return (
                                  <tr key={patient.id}>
                                    <td className={styles.patientNameClickable} onClick={() => handlePatientClick(patient)}>{patient.name}</td>
                                    <td>{patient.birthDate}</td>
                                    <td>{patient.gender}</td>
                                    <td>{patient.age}세</td>
                                    <td>{patient.lastVisit}</td>
                                    <td>
                                      <div className={styles.actionButtons}>
                                        {isWaiting ? <span className={styles.alreadyCheckedIn}>접수 완료</span> : <button className={styles.checkinBtn} onClick={() => handleCheckinClick(patient)}>현장 접수</button>}
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
                    {/* Pagination */}
                    {patients.length > 0 && (
                      <div className={styles.pagination}>
                        <button className={styles.pageButton} onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>이전</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                          <button key={pageNumber} className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ''}`} onClick={() => handlePageChange(pageNumber)}>{pageNumber}</button>
                        ))}
                        <button className={styles.pageButton} onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>다음</button>
                      </div>
                    )}

                  </div>
                </div>
              ) : contentTab === 'newPatient' ? (
                <div className={styles.contentBody}>
                  <PatientRegistrationForm onSubmit={handlePatientRegistrationSubmit} onCancel={() => setContentTab('search')} />
                </div>
              ) : (
                <div className={styles.contentBody}>
                  {/* Appointments Table */}
                  <div className={`${styles.appointmentContainer} ${styles.tabAppointmentContainer}`}>
                    <div className={styles.sectionHeader}>
                      <h3 className={styles.sectionTitle}>금일 예약 {new Date().toLocaleDateString('ko-KR')}</h3>
                    </div>
                    <div className={styles.tableContainer}>
                      <table className={styles.scheduleTable}>
                        <thead><tr><th>요청일시</th><th>환자명</th><th>환자번호</th><th>연락처</th><th>희망일시</th><th>상태</th></tr></thead>
                        <tbody>
                          {appointments.map(apt => (
                            <tr key={apt.id} onClick={() => { setSelectedAppointment(apt); setIsAppointmentModalOpen(true); }} className={styles.appointmentRow}>
                              <td>{apt.createdAt ? new Date(apt.createdAt).toLocaleString('ko-KR') : '-'}</td>
                              <td>{apt.patientName}</td><td>{apt.patientId}</td><td>{apt.phone}</td>
                              <td>{apt.appointmentDate} {apt.time}</td>
                              <td><span className={`${styles.appointmentStatus} ${styles[apt.status]}`}>{apt.status}</span></td>
                            </tr>
                          ))}
                          {appointments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>예약 없음</td></tr>}
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
              <div className={styles.contentTabs}>
                <button className={`${styles.contentTab} ${receptionTab === 'reception' ? styles.active : ''}`} onClick={() => setReceptionTab('reception')}>오더 대기</button>
                <button className={`${styles.contentTab} ${receptionTab === 'testWaiting' ? styles.active : ''}`} onClick={() => setReceptionTab('testWaiting')}>검사결과 대기</button>
                <button className={`${styles.contentTab} ${receptionTab === 'additional' ? styles.active : ''}`} onClick={() => setReceptionTab('additional')}>추가진료</button>
                <button className={`${styles.contentTab} ${receptionTab === 'payment' ? styles.active : ''}`} onClick={() => setReceptionTab('payment')}>수납대기</button>
                <button className={`${styles.contentTab} ${receptionTab === 'appSync' ? styles.active : ''}`} onClick={() => setReceptionTab('appSync')}>앱 연동</button>
              </div>
              <div className={styles.tableContainer}>
                {receptionTab === 'reception' && <OrderList refreshTrigger={orderRefreshTrigger} onOpenVitalCheckModal={handleOpenVitalCheckModal} />}
                {receptionTab === 'testWaiting' && <OrderList refreshTrigger={orderRefreshTrigger} onOpenVitalCheckModal={handleOpenVitalCheckModal} showInProgressOnly={true} />}
                {receptionTab === 'additional' && (
                  <UnifiedQueueList
                    header={
                      <div className={styles.rightQueueHeader}>
                        <div className={styles.colNameId}>환자명(ID)</div>
                        <div className={styles.colDocTime}>담당의 | 시간</div>
                        <div className={styles.colStatus}>상태</div>
                      </div>
                    }
                    items={additionalPatients}
                    isLoading={isLoadingQueue}
                    emptyMessage="대기 중인 추가 진료 환자가 없습니다."
                    currentPage={additionalPage}
                    onPageChange={setAdditionalPage}
                    itemsPerPage={itemsPerPage}
                    renderItem={(patient: any) => (
                      <div key={patient.encounter_id} className={`${styles.rightQueueItem} ${styles.rightQueueItemRow}`}>
                        <div className={styles.textName}>
                          {patient.patient_name} <span className={styles.subText}>({patient.patient_id})</span>
                        </div>
                        <div className={styles.textDetail}>
                          {patient.doctor_name} | {patient.updated_at ? new Date(patient.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                        <div className={styles.badgeContainer}>
                          <div className={`${styles.rightQueueBadge} ${styles.rightQueueBadgeAdditional}`}>추가진료</div>
                        </div>
                      </div>
                    )}
                  />
                )}
                {receptionTab === 'payment' && (
                  <UnifiedQueueList
                    header={
                      <div className={styles.rightQueueHeader}>
                        <div className={styles.colName}>환자명</div>
                        <div className={styles.colIdTime}>ID | 시간</div>
                        <div className={styles.colStatus}>상태</div>
                      </div>
                    }
                    items={paymentPatients}
                    isLoading={isLoadingQueue}
                    emptyMessage="수납 대기 중인 환자가 없습니다."
                    currentPage={paymentPage}
                    onPageChange={setPaymentPage}
                    itemsPerPage={itemsPerPage}
                    renderItem={(patient: any) => (
                      <div
                        key={patient.encounter_id}
                        className={`${styles.rightQueueItem} ${styles.rightQueueClickable} ${styles.rightQueueItemRow}`}
                        onClick={() => { setSelectedPaymentPatient(patient); setIsPaymentModalOpen(true); }}
                      >
                        <div className={styles.textName}>
                          {patient.patient_name}
                        </div>
                        <div className={styles.textDetail}>
                          {patient.patient_id} | {patient.updated_at ? new Date(patient.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                        <div className={styles.badgeContainer}>
                          <div className={`${styles.rightQueueBadge} ${styles.rightQueueBadgePayment}`}>수납대기</div>
                        </div>
                      </div>
                    )}
                  />
                )}
                {receptionTab === 'appSync' && (
                  <div className={styles.rightQueueList} style={{ gap: '0' }}>
                    {/* 헤더 추가 */}
                    <div className={styles.rightQueueHeaderAppSync}>
                      <div>닉네임</div>
                      <div>요청 승인/거절</div>
                    </div>

                    {isAppSyncLoading ? (
                      <div className={styles.loading}>정보를 불러오는 중...</div>
                    ) : appSyncRequests.length === 0 ? (
                      <div className={styles.emptyState}>승인 대기 중인 앱 연동 요청이 없습니다.</div>
                    ) : (
                      appSyncRequests.map(req => (
                        <div key={req.request_id} className={styles.appSyncItem}>
                          <div className={styles.appSyncNickname}>{req.profile_nickname}</div>
                          <div className={styles.appSyncBtnGroup}>
                            <button onClick={() => handleApproveAppSync(req)} className={`${styles.appSyncBtn} ${styles.appSyncBtnApprove}`}>승인</button>
                            <button onClick={() => handleRejectAppSync(req)} className={`${styles.appSyncBtn} ${styles.appSyncBtnReject}`}>거절</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 진료실별 대기 현황 (상세) */}
        <div className={styles.detailedWaitingContainer}>
          <h3 className={styles.sectionTitle}>진료실별 대기 현황</h3>
          <div className={styles.waitingDetailCards}>
            {clinicWaitingList.map((clinic) => {
              const viewMode = clinicViewModes[clinic.id] || 'WAITING';
              return (
                <div key={clinic.id} className={styles.waitingDetailCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleSection}>
                      <div className={styles.cardTitleGroup}>
                        <span className={styles.cardRoom}>{clinic.roomNumber}</span>
                        <span className={styles.cardDoctor}>{clinic.doctorName}</span>
                        <span className={styles.cardClinic}>({clinic.clinicName})</span>
                      </div>
                      <button
                        className={`${styles.cardButton} ${viewMode === 'COMPLETED' ? styles.cardButtonActive : styles.cardButtonInactive}`}
                        onClick={() => toggleClinicViewMode(clinic.id)}
                      >
                        {viewMode === 'COMPLETED' ? '진료완료' : '진료대기'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    {clinic.patients.filter(p => viewMode === 'COMPLETED' ? (p.status === '진료완료' || p.status === '결과대기') : (p.status === '진료중' || p.status === '대기중')).map((p, idx) => (
                      <div key={idx} className={styles.waitingPatientRow} onClick={() => { if (viewMode === 'COMPLETED') { setSelectedEncounterId(p.encounterId); setSelectedPatientNameForModal(p.name); setIsEncounterModalOpen(true); } }}>
                        <div className={styles.patientDetailRow}>
                          <span className={styles.patientIndex}>{idx + 1}</span>
                          <span className={styles.patientNameLarge}>{p.name}</span>
                          <span className={styles.patientPhoneLarge}>{p.phone}</span>
                        </div>
                        <div className={styles.patientActions}>
                          <span className={styles.statusBadgeLarge} style={{ backgroundColor: p.status === '진료중' ? 'var(--sky-400)' : 'var(--sky-200)' }}>{p.status}</span>
                          {viewMode !== 'COMPLETED' && p.status !== '진료중' && <button className={styles.cancelWaitingBtn} onClick={(e) => { e.stopPropagation(); handleCancelWaiting(p.encounterId, p.name, p.status); }}>취소</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isModalOpen && selectedPatient && <PatientDetailModal isOpen={isModalOpen} patient={selectedPatient} isEditing={isEditing} onClose={handleCloseModal} onEdit={handleEditToggle} onCancelEdit={handleCancelEdit} onSave={handleUpdatePatient} />}
      <CheckinModal isOpen={isCheckinModalOpen} patient={checkinPatient} doctors={sidebarDoctors} onClose={() => setIsCheckinModalOpen(false)} onSubmit={handleCheckinSubmit} />
      {isAppointmentModalOpen && selectedAppointment && (
        <div className={styles.modalOverlay} onClick={() => setIsAppointmentModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}><h2>예약 승인</h2></div>
            <div className={styles.modalBody}>
              <p>{selectedAppointment.patientName} ({selectedAppointment.time})</p>
              <select value={appointmentDoctor || ''} onChange={e => setAppointmentDoctor(Number(e.target.value))}>
                <option value="">의사 선택</option>
                {sidebarDoctors.map((d: any) => <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>)}
              </select>
              <div className={styles.modalActions}>
                <button className={styles.submitButton} onClick={async () => {
                  if (!appointmentDoctor) return;
                  await updateAppointment(selectedAppointment.appointmentId!, { doctor: appointmentDoctor, status: '승인완료' });
                  setIsAppointmentModalOpen(false); setAppointmentDoctor(null); fetchTodayAppointments();
                }}>승인</button>
                <button className={styles.cancelButton} onClick={() => setIsAppointmentModalOpen(false)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <QuestionnaireModal isOpen={isQuestionnaireModalOpen} patient={questionnairePatient} initialData={questionnaireInitialData} onClose={() => { setIsQuestionnaireModalOpen(false); setQuestionnairePatient(null); }} onSubmit={handleQuestionnaireSubmit} onDelete={handleQuestionnaireDelete} />
      <EncounterDetailModal isOpen={isEncounterModalOpen} encounterId={selectedEncounterId} patientName={selectedPatientNameForModal} onClose={() => setIsEncounterModalOpen(false)} />
      <VitalMeasurementModal isOpen={isVitalCheckModalOpen} order={selectedVitalOrder} onClose={() => setIsVitalCheckModalOpen(false)} onSubmit={handleVitalCheckSubmit} />
      {/* Payment Modal (Enhanced) */}
      {isPaymentModalOpen && selectedPaymentPatient && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ width: '450px', padding: '0', overflow: 'hidden' }}>
            <div className={styles.modalHeader} style={{ padding: '20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💳 수납 결제
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>
                  | {selectedPaymentPatient.patient_name} ({selectedPaymentPatient.patient_id})
                </span>
              </h2>
            </div>

            <div style={{ padding: '24px' }}>
              {/* 청구 내역 요약 */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#334155' }}>청구 내역</h3>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#64748b' }}>
                    <span>진찰료</span>
                    <span>15,000원</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#64748b' }}>
                    <span>검사료 (본인부담금)</span>
                    <span>35,000원</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#64748b' }}>
                    <span>처방료</span>
                    <span>5,000원</span>
                  </div>
                  <div style={{ borderTop: '1px dashed #cbd5e1', margin: '12px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#334155' }}>총 청구 금액</span>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>55,000원</span>
                  </div>
                </div>
              </div>

              {/* 결제 수단 */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#334155' }}>결제 수단</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{
                    flex: 1, cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500'
                  }}>
                    <input type="radio" name="paymentMethod" defaultChecked /> 신용카드
                  </label>
                  <label style={{
                    flex: 1, cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500'
                  }}>
                    <input type="radio" name="paymentMethod" /> 현금
                  </label>
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '0' }}>
                <button className={styles.submitButton} onClick={handlePaymentSubmit} style={{ flex: 2, padding: '12px', fontSize: '15px' }}>
                  55,000원 결제하기
                </button>
                <button className={styles.cancelButton} onClick={() => setIsPaymentModalOpen(false)} style={{ flex: 1, padding: '12px', fontSize: '15px' }}>
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Notification */}
      {notification && <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#333', color: 'white', padding: '15px', borderRadius: '5px', zIndex: 9999 }}>{notification.message}</div>}
    </>
  );
}
