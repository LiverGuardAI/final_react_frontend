import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import {
  registerPatient,
  getPatientList,
  getPatientDetail,
  updatePatient,
  type PatientRegistrationData,
  type PatientUpdateData
} from "../../api/administrationApi";
import styles from './HomePage.module.css';
import SchedulePage from './SchedulePage';
import AppointmentManagementPage from './AppointmentManagementPage';
import PatientManagementPage from './PatientManagementPage';
import QuestionnaireFormPage from './QuestionnaireFormPage';

interface Patient {
  id: number;
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
  status: '예약완료' | '접수완료' | '진료중';
}

interface ClinicWaiting {
  id: number;
  clinicName: string;
  patients: {
    name: string;
    phone: string;
    status: '진료중' | '대기중' | '접수완료';
  }[];
}

type TabType = 'home' | 'schedule' | 'appointments' | 'patients' | 'questionnaire';
type ContentTabType = 'search' | 'newPatient';

export default function AdministrationHomePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [staffName, setStaffName] = useState<string>('원무과');
  const [departmentName, setDepartmentName] = useState<string>('부서');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [contentTab, setContentTab] = useState<ContentTabType>('search');
  const [searchQuery, setSearchQuery] = useState('');

  // 신규 환자 등록 폼 state
  const [newPatientForm, setNewPatientForm] = useState({
    patient_id: '',
    name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    phone: '',
    sample_id: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // DB에서 가져온 환자 데이터
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 5;

  // 환자 상세 모달
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    phone: '',
    sample_id: '',
  });

  // 금일 예약 데이터
  const [appointments] = useState<Appointment[]>([
    {
      id: 1,
      time: '09:00~09:30',
      patientName: '송영운',
      phone: '981008-1******',
      doctor: '정예진',
      consultationType: '복통, 소화불량',
      status: '예약완료'
    },
    {
      id: 2,
      time: '10:00~10:30',
      patientName: '장보윤',
      phone: '960922-1******',
      doctor: '정예진',
      consultationType: '정기 검진',
      status: '접수완료'
    },
    {
      id: 3,
      time: '14:00~14:30',
      patientName: '김철수',
      phone: '850315-1******',
      doctor: '송영운',
      consultationType: '두통, 어지러움 증상',
      status: '예약완료'
    },
  ]);

  // 진료실별 대기 현황
  const [clinicWaitingList] = useState<ClinicWaiting[]>([
    {
      id: 1,
      clinicName: '진료실 1 (송영운)',
      patients: [
        { name: '송영운', phone: '981008-1******', status: '진료중' }
      ]
    },
    {
      id: 2,
      clinicName: '진료실 2 (송영운)',
      patients: [
        { name: '송영운', phone: '960922-1******', status: '대기중' },
        { name: '송영운', phone: '960922-1******', status: '접수완료' }
      ]
    },
    {
      id: 3,
      clinicName: '후무 진료실 3 (송영운)',
      patients: []
    }
  ]);

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
    const storedAdmin = localStorage.getItem('administration');
    if (!storedAdmin) {
      return;
    }

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

    // 초기 환자 목록 로드
    fetchPatients();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('administration');

    logout();
    navigate('/');
  };

  // 신규 환자 폼 입력 핸들러
  const handleFormChange = (field: keyof typeof newPatientForm, value: string) => {
    setNewPatientForm(prev => ({ ...prev, [field]: value }));
    setFormError(''); // 입력 시 에러 메시지 제거
  };

  // 신규 환자 등록 제출 핸들러
  const handlePatientRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      // 필수 필드 검증
      if (!newPatientForm.patient_id || !newPatientForm.name || !newPatientForm.date_of_birth || !newPatientForm.gender) {
        setFormError('필수 항목을 모두 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      // API 호출
      const data: PatientRegistrationData = {
        patient_id: newPatientForm.patient_id.trim(),
        name: newPatientForm.name.trim(),
        date_of_birth: newPatientForm.date_of_birth,
        gender: newPatientForm.gender,
        phone: newPatientForm.phone.trim() || undefined,
        sample_id: newPatientForm.sample_id.trim() || undefined,
      };

      const response = await registerPatient(data);

      alert(`환자 등록 완료: ${response.patient.name} (${response.patient.patient_id})`);

      // 폼 초기화
      setNewPatientForm({
        patient_id: '',
        name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        sample_id: '',
      });

      // 검색 탭으로 전환 (선택사항)
      setContentTab('search');

    } catch (error: any) {
      console.error('환자 등록 실패:', error);

      if (error.response?.data) {
        const errorData = error.response.data;
        // 백엔드에서 반환한 에러 메시지 표시
        if (typeof errorData === 'object') {
          const errorMessages = Object.values(errorData).flat().join(', ');
          setFormError(errorMessages || '환자 등록에 실패했습니다.');
        } else {
          setFormError(errorData || '환자 등록에 실패했습니다.');
        }
      } else {
        setFormError('서버와의 통신에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 폼 취소 핸들러
  const handleFormCancel = () => {
    setNewPatientForm({
      patient_id: '',
      name: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      sample_id: '',
    });
    setFormError('');
    setContentTab('search');
  };

  // 환자 목록 가져오기
  const fetchPatients = async (search?: string) => {
    setIsLoadingPatients(true);
    try {
      const response = await getPatientList(search || searchQuery);

      // DB 데이터를 UI 형식에 맞게 변환
      const formattedPatients: Patient[] = response.results.map((p: any) => ({
        id: p.patient_id, // patient_id를 id로 사용
        name: p.name,
        birthDate: p.date_of_birth || 'N/A', // YYYY-MM-DD 형식
        age: p.age || 0,
        gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : 'N/A',
        phone: p.phone || 'N/A',
        emergencyContact: 'N/A',
        address: 'N/A',
        registrationDate: p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : 'N/A',
        lastVisit: 'None', // 최근 방문 기록은 Encounter에서 가져와야 함
      }));

      setPatients(formattedPatients);
    } catch (error) {
      console.error('환자 목록 조회 실패:', error);
      setPatients([]);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  // 검색어 변경 시 환자 목록 갱신
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
    if (value.trim()) {
      fetchPatients(value);
    } else {
      fetchPatients('');
    }
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
        sample_id: detailData.sample_id || '',
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
        sample_id: editForm.sample_id || undefined,
      };

      const response = await updatePatient(selectedPatient.id.toString(), updateData);

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

          {/* 진료실별 대기 현황 섹션 */}
          <div className={styles.waitingSection}>
            <div className={styles.waitingSectionTitle}>진료실별 대기 현황</div>
            <div className={styles.waitingList}>
              {clinicWaitingList.map((clinic) => (
                <div key={clinic.id} className={styles.waitingClinicCard}>
                  <div className={styles.clinicHeader}>
                    <span className={styles.clinicName}>{clinic.clinicName}</span>
                    <button className={styles.clinicDetailButton}>진료대기</button>
                  </div>
                  <div className={styles.clinicPatients}>
                    {clinic.patients.length > 0 ? (
                      clinic.patients.map((patient, index) => (
                        <div key={index} className={styles.clinicPatientItem}>
                          <div className={styles.patientInfo}>
                            <span className={styles.patientNameSmall}>{patient.name}</span>
                            <span className={styles.patientPhone}>{patient.phone}</span>
                          </div>
                          <span className={`${styles.statusTag} ${styles[patient.status]}`}>
                            {patient.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyClinic}>대기 환자 없음</div>
                    )}
                  </div>
                </div>
              ))}
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
              className={`${styles.tabButton} ${activeTab === 'questionnaire' ? styles.active : ''}`}
              onClick={() => handleTabClick('questionnaire')}
            >
              <span>문진표 작성</span>
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
              onClick={handleLogout}
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
          {activeTab === 'schedule' ? (
            <SchedulePage />
          ) : activeTab === 'appointments' ? (
            <AppointmentManagementPage />
          ) : activeTab === 'patients' ? (
            <PatientManagementPage />
          ) : activeTab === 'questionnaire' ? (
            <QuestionnaireFormPage />
          ) : (
          <div className={styles.mainLayout}>
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
                                currentPatients.map((patient) => (
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
                                        <button className={styles.checkinBtn} title="현장 접수">현장 접수</button>
                                        <button className={styles.appointmentBtn} title="예약 등록">예약 등록</button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
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
                ) : (
                  <div className={styles.contentBody}>
                    {/* 신규 환자 등록 폼 */}
                    <form className={styles.registrationForm} onSubmit={handlePatientRegistration}>
                      {formError && (
                        <div style={{ color: 'red', marginBottom: '15px', padding: '10px', backgroundColor: '#fee', borderRadius: '4px' }}>
                          {formError}
                        </div>
                      )}

                      <div className={styles.formSection}>
                        <h3 className={styles.formSectionTitle}>기본 정보</h3>
                        <div className={styles.formGrid}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>환자 ID <span className={styles.required}>*</span></label>
                            <input
                              type="text"
                              className={styles.formInput}
                              placeholder="P-2024-0001"
                              value={newPatientForm.patient_id}
                              onChange={(e) => handleFormChange('patient_id', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>이름 <span className={styles.required}>*</span></label>
                            <input
                              type="text"
                              className={styles.formInput}
                              placeholder="환자 이름"
                              value={newPatientForm.name}
                              onChange={(e) => handleFormChange('name', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>생년월일 <span className={styles.required}>*</span></label>
                            <input
                              type="date"
                              className={styles.formInput}
                              value={newPatientForm.date_of_birth}
                              onChange={(e) => handleFormChange('date_of_birth', e.target.value)}
                              required
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>성별 <span className={styles.required}>*</span></label>
                            <select
                              className={styles.formInput}
                              value={newPatientForm.gender}
                              onChange={(e) => handleFormChange('gender', e.target.value)}
                              required
                            >
                              <option value="">선택</option>
                              <option value="M">남성</option>
                              <option value="F">여성</option>
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>전화번호</label>
                            <input
                              type="tel"
                              className={styles.formInput}
                              placeholder="010-0000-0000"
                              value={newPatientForm.phone}
                              onChange={(e) => handleFormChange('phone', e.target.value)}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Sample ID</label>
                            <input
                              type="text"
                              className={styles.formInput}
                              placeholder="샘플 ID (선택)"
                              value={newPatientForm.sample_id}
                              onChange={(e) => handleFormChange('sample_id', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={styles.formActions}>
                        <button
                          type="button"
                          className={styles.cancelButton}
                          onClick={handleFormCancel}
                          disabled={isSubmitting}
                        >
                          취소
                        </button>
                        <button
                          type="submit"
                          className={styles.submitButton}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? '등록 중...' : '환자 등록'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* 오른쪽 영역 - 금일 예약 */}
            <div className={styles.rightSection}>
              {/* 금일 예약 */}
              <div className={styles.appointmentContainer}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>금일 예약 2025-12.11(목)</h3>
                  <span className={styles.currentTime}>16:29:30</span>
                </div>
                <div className={styles.appointmentTable}>
                  <table className={styles.scheduleTable}>
                    <thead>
                      <tr>
                        <th>시간</th>
                        <th>환자명</th>
                        <th>생년월일</th>
                        <th>담당의사</th>
                        <th>증상/내용</th>
                        <th>상태</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appointment) => (
                        <tr key={appointment.id}>
                          <td>{appointment.time}</td>
                          <td>{appointment.patientName}</td>
                          <td>{appointment.phone}</td>
                          <td>{appointment.doctor}</td>
                          <td>{appointment.consultationType}</td>
                          <td>
                            <span className={`${styles.appointmentStatus} ${styles[appointment.status]}`}>
                              {appointment.status}
                            </span>
                          </td>
                          <td>
                            {appointment.status === '예약완료' ? (
                              <button className={styles.approveBtn} title="예약 승인 및 접수">승인</button>
                            ) : appointment.status === '접수완료' ? (
                              <button className={styles.assignBtn} title="진료실 배정">배정</button>
                            ) : (
                              <span className={styles.inProgressText}>진료중</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 앱 예약 요청 관리 - 2행 전체 */}
            <div className={styles.appointmentManagementContainer}>
              <h3 className={styles.sectionTitle}>앱 예약 요청 관리</h3>
              <div className={styles.tableContainer}>
                <table className={styles.scheduleTable}>
                  <thead>
                    <tr>
                      <th>요청일시</th>
                      <th>환자명</th>
                      <th>환자번호</th>
                      <th>연락처</th>
                      <th>희망일시</th>
                      <th>증상</th>
                      <th>상태</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2024-12-20 14:30</td>
                      <td className={styles.patientName}>김철수</td>
                      <td>P2024001</td>
                      <td>010-1234-5678</td>
                      <td>2024-12-23 10:00</td>
                      <td>우측 상복부 불편감, 피로감</td>
                      <td>
                        <span className={`${styles.appointmentStatus} ${styles['예약완료']}`}>요청중</span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button className={styles.approveBtn}>의사 배정</button>
                          <button className={styles.rejectBtn}>거절</button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>2024-12-21 09:15</td>
                      <td className={styles.patientName}>이영희</td>
                      <td>P2024045</td>
                      <td>010-2345-6789</td>
                      <td>2024-12-23 14:00</td>
                      <td>복부 팽만감, 식욕 저하</td>
                      <td>
                        <span className={`${styles.appointmentStatus} ${styles['예약완료']}`}>요청중</span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button className={styles.approveBtn}>의사 배정</button>
                          <button className={styles.rejectBtn}>거절</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 진료실별 대기 현황 (상세) - 3행 전체 */}
            <div className={styles.detailedWaitingContainer}>
              <h3 className={styles.sectionTitle}>진료실별 대기 현황</h3>
              <div className={styles.waitingDetailCards}>
                {clinicWaitingList.map((clinic) => (
                  <div key={clinic.id} className={styles.waitingDetailCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleSection}>
                        <span className={styles.cardTitle}>{clinic.clinicName}</span>
                        <button className={styles.cardButton}>진료대기</button>
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      {clinic.patients.length > 0 ? (
                        clinic.patients.map((patient, index) => (
                          <div key={index} className={styles.waitingPatientRow}>
                            <div className={styles.patientDetail}>
                              <span className={styles.patientNameLarge}>{patient.name}</span>
                              <span className={styles.patientPhoneLarge}>{patient.phone}</span>
                            </div>
                            <span className={`${styles.statusBadgeLarge} ${styles[patient.status]}`}>
                              {patient.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.emptyWaiting}>대기 환자가 없습니다</div>
                      )}
                    </div>
                  </div>
                ))}
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

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>샘플 ID</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={editForm.sample_id}
                      onChange={(e) => handleEditFormChange('sample_id', e.target.value)}
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
    </div>
  );
}
