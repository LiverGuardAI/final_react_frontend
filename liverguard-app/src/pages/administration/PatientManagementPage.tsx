import React, { useState, useEffect } from "react";
import styles from "./PatientManagementPage.module.css";
import { getPatients, getEncounters, getAppointments, createQuestionnaire } from "../../api/receptionApi";
import { updatePatient, type PatientUpdateData } from "../../api/hospitalOpsApi";
import VitalMeasurementModal from "../../components/administration/VitalMeasurementModal";
import PhysicalExamModal from "../../components/administration/PhysicalExamModal";
import QuestionnaireModal from "../../components/administration/QuestionnaireModal";
import { useAdministrationData } from "../../contexts/AdministrationContext";

// --- Interfaces ---

interface Patient {
  id: string;
  patientId: string;
  name: string;
  birthDate: string;
  gender: string;
  phone: string;
  registrationDate: string;
  lastVisitDate: string;
  totalVisits: number;
}

interface QuestionnaireData {
  chief_complaint: string;
  symptom_duration: string;
  pain_level: number;
  medications?: string;
  allergies?: string;
  [key: string]: any;
}

interface MedicalHistory {
  id: string;
  date: string;
  doctor: string;
  department: string;
  diagnosis: string;
  treatment: string;
  prescription?: string;
  questionnaireData?: QuestionnaireData;
  questionnaireStatus?: string;
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  doctor: string;
  department: string;
  status: '예정' | '완료' | '취소';
}

const PatientManagementPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "history" | "appointments">("info");

  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState<'none' | 'vital' | 'physical'>('none');
  const [selectedForAction, setSelectedForAction] = useState<Patient | null>(null);

  // Modals for Actions
  const [isVitalModalOpen, setIsVitalModalOpen] = useState(false);
  const [isPhysicalModalOpen, setIsPhysicalModalOpen] = useState(false);

  // 진료 기록 및 예약 데이터
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // 문진표 모달
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [questionnairePatient, setQuestionnairePatient] = useState<Patient | null>(null);

  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    phone: '',
  });

  // Context Data
  const { refreshPatientsTrigger } = useAdministrationData();

  // 환자 목록 로드
  const fetchPatientList = async (search?: string) => {
    setIsLoading(true);
    try {
      const response = await getPatients(search);

      setPatients(response.results.map((p: any) => ({
        id: p.patient_id,
        patientId: p.patient_id,
        name: p.name,
        birthDate: p.date_of_birth || 'N/A',
        gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : 'N/A',
        phone: p.phone || 'N/A',
        registrationDate: p.created_at ? p.created_at.split('T')[0] : 'N/A',
        lastVisitDate: p.last_visit ? p.last_visit.split('T')[0] : '없음',
        totalVisits: p.total_visits || 0,
      })));
    } catch (error) {
      console.error('환자 목록 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    if (birthDate === 'N/A') return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Listen to refresh trigger
  useEffect(() => {
    fetchPatientList(searchTerm);
  }, [refreshPatientsTrigger]);

  useEffect(() => {
    fetchPatientList();
  }, []);

  const filteredPatients = patients.filter(patient => {
    const matchesSearch =
      patient.name.includes(searchTerm) ||
      patient.patientId.includes(searchTerm) ||
      patient.phone.includes(searchTerm);
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredPatients.length);
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  const handleViewDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("info");
    setIsEditing(false);

    setEditForm({
      name: patient.name,
      date_of_birth: patient.birthDate,
      gender: patient.gender === '남' ? 'M' : patient.gender === '여' ? 'F' : '',
      phone: patient.phone,
    });

    if (medicalHistory.length > 0 && selectedPatient?.id === patient.id) {
      return;
    }

    try {
      const [encountersData, appointmentsData] = await Promise.all([
        getEncounters(patient.patientId),
        getAppointments({ patient_id: patient.patientId })
      ]);

      const formattedHistory: MedicalHistory[] = encountersData.results.map((e: any) => ({
        id: e.encounter_id,
        date: e.encounter_date,
        doctor: e.doctor_name || 'N/A',
        department: e.department || 'N/A',
        diagnosis: e.clinical_notes || '진료 중',
        treatment: e.encounter_status === 'COMPLETED' ? '완료' : '진행 중',
        prescription: undefined,
        questionnaireData: e.questionnaire_data,
        questionnaireStatus: e.questionnaire_status_display,
      }));
      setMedicalHistory(formattedHistory);

      setPatients(prev => prev.map(p => p.id === patient.id ? {
        ...p,
        totalVisits: formattedHistory.length,
        lastVisitDate: formattedHistory.length > 0 ? formattedHistory[0].date : 'N/A'
      } : p));

      const formattedAppointments: Appointment[] = appointmentsData.results.map((a: any) => ({
        id: a.appointment_id,
        date: a.appointment_date,
        time: a.appointment_time,
        doctor: a.doctor_name || 'N/A',
        department: a.department || 'N/A',
        status: (a.status === 'CONFIRMED' || a.status === '승인완료') ? '예정' :
          a.status === 'COMPLETED' ? '완료' : '취소',
      }));
      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('환자 정보 조회 실패:', error);
    }
  };

  const handleCloseModal = () => {
    setSelectedPatient(null);
    setActiveTab("info");
    setIsEditing(false);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleSavePatient = async () => {
    if (!selectedPatient) return;

    try {
      const updateData: PatientUpdateData = {
        name: editForm.name,
        date_of_birth: editForm.date_of_birth,
        gender: editForm.gender as 'M' | 'F',
        phone: editForm.phone || undefined,
      };

      await updatePatient(selectedPatient.patientId, updateData);

      const updatedPatient = {
        ...selectedPatient,
        name: editForm.name,
        birthDate: editForm.date_of_birth,
        gender: editForm.gender === 'M' ? '남' : '여',
        phone: editForm.phone,
      };
      setSelectedPatient(updatedPatient);

      setPatients(prev => prev.map(p =>
        p.id === selectedPatient.id ? updatedPatient : p
      ));

      setIsEditing(false);
      alert('환자 정보가 수정되었습니다.');
    } catch (error: any) {
      console.error('환자 정보 수정 실패:', error);
      alert(error.response?.data?.message || '환자 정보 수정에 실패했습니다.');
    }
  };

  const handleQuestionnaireSubmit = async (data: QuestionnaireData) => {
    try {
      if (questionnairePatient) {
        await createQuestionnaire({ ...data, patient_id: questionnairePatient.patientId });
      }

      alert('문진표가 제출되었습니다.');
      setIsQuestionnaireModalOpen(false);
      setQuestionnairePatient(null);

      if (selectedPatient) {
        handleViewDetails(selectedPatient);
      }
    } catch (error: any) {
      console.error('문진표 제출 실패:', error);
      alert(error.response?.data?.message || '문진표 제출 중 오류가 발생했습니다.');
    }
  };

  const handleModeChange = (mode: 'vital' | 'physical') => {
    setSelectionMode(mode);
    setSelectedForAction(null);
  };

  const handleCancelSelection = () => {
    setSelectionMode('none');
    setSelectedForAction(null);
  };

  const handleSelectPatient = (patient: Patient) => {
    if (selectedForAction?.id === patient.id) {
      setSelectedForAction(null);
    } else {
      setSelectedForAction(patient);
    }
  };

  const handleSelectionConfirm = () => {
    if (!selectedForAction) return;

    const actionName = selectionMode === 'vital' ? '바이탈 측정' : '신체 계측';
    const isConfirmed = window.confirm(`[${selectedForAction.name}] 환자의 ${actionName}을(를) 진행하시겠습니까?`);

    if (isConfirmed) {
      if (selectionMode === 'vital') {
        setIsVitalModalOpen(true);
      } else {
        setIsPhysicalModalOpen(true);
      }
    }
  };

  const handleVitalSubmit = async (data: any) => {
    console.log("Vital Data Submitted:", data, "For Patient:", selectedForAction);
    alert(`${selectedForAction?.name} 님의 바이탈 정보가 저장되었습니다.`);
    setIsVitalModalOpen(false);
    handleCancelSelection();
  };

  const handlePhysicalSubmit = async (data: any) => {
    console.log("Physical Data Submitted:", data, "For Patient:", selectedForAction);
    alert(`${selectedForAction?.name} 님의 신체 계측 정보가 저장되었습니다.`);
    setIsPhysicalModalOpen(false);
    handleCancelSelection();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>환자 관리</h2>
        <div className={styles.stats}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>전체 환자</span>
            <span className={styles.statValue}>{patients.length}</span>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <div className={styles.controls}>
            <div className={styles.leftControls}>
              <button
                className={`${styles.actionButton} ${styles.vitalBtn} ${selectionMode === "vital" ? styles.active : ""}`}
                onClick={() => handleModeChange("vital")}
              >
                바이탈 측정
              </button>
              <button
                className={`${styles.actionButton} ${styles.physicalBtn} ${selectionMode === "physical" ? styles.active : ""}`}
                onClick={() => handleModeChange("physical")}
              >
                신체 계측
              </button>
            </div>
            <div className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="환자명, 환자번호, 연락처로 검색"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    fetchPatientList(searchTerm);
                  }
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    fetchPatientList("");
                  }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: '16px',
                    cursor: 'pointer',
                    color: '#999'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {selectionMode !== 'none' && (
            <div className={styles.selectionBanner}>
              <span>
                {selectionMode === 'vital' ? '바이탈 측정' : '신체 계측'}할 환자를 선택하세요.
                {selectedForAction && <span className={styles.selectedName}> (선택됨: {selectedForAction.name})</span>}
              </span>
              <div className={styles.bannerActions}>
                <button
                  className={styles.confirmSelectionBtn}
                  disabled={!selectedForAction}
                  onClick={handleSelectionConfirm}
                >
                  확인
                </button>
                <button className={styles.cancelSelectionBtn} onClick={handleCancelSelection}>취소</button>
              </div>
            </div>
          )}
        </div>
        <div className={styles.tableContainer}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>환자 목록을 불러오는 중...</div>
          ) : (
            <table className={styles.patientTable}>
              <thead>
                <tr>
                  {selectionMode !== 'none' && <th>선택</th>}
                  <th>환자번호</th>
                  <th>이름</th>
                  <th>생년월일</th>
                  <th>나이</th>
                  <th>성별</th>
                  <th>연락처</th>
                  <th>최근 방문일</th>
                  <th>총 방문 횟수</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={selectionMode !== 'none' ? 10 : 9} style={{ textAlign: 'center', padding: '20px' }}>
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedPatients.map(patient => (
                    <tr key={patient.id} className={selectedForAction?.id === patient.id ? styles.selectedRow : ''} onClick={() => selectionMode !== 'none' && handleSelectPatient(patient)}>
                      {selectionMode !== 'none' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedForAction?.id === patient.id}
                            onChange={() => handleSelectPatient(patient)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      )}
                      <td>{patient.patientId}</td>
                      <td className={styles.patientName}>{patient.name}</td>
                      <td>{patient.birthDate}</td>
                      <td>{calculateAge(patient.birthDate)}세</td>
                      <td>{patient.gender}</td>
                      <td>{patient.phone}</td>
                      <td>{patient.lastVisitDate}</td>
                      <td>{patient.totalVisits}회</td>
                      <td>
                        <button
                          className={styles.detailBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(patient);
                          }}
                        >
                          상세보기
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && filteredPatients.length > 0 && (
          <div className={styles.paginationBar}>
            <div className={styles.pageInfo}>
              {startIndex + 1}-{endIndex} / {filteredPatients.length}
            </div>
            <div className={styles.pagination}>
              <button
                className={styles.pageButton}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage === 1}
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={`${styles.pageButton} ${safePage === pageNumber ? styles.activePage : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                className={styles.pageButton}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
              >
                다음
              </button>
            </div>
            <div className={styles.pageSize}>
              <label htmlFor="patient-page-size">페이지당</label>
              <select
                id="patient-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 환자 상세 모달 */}
      {selectedPatient && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {selectedPatient.name} ({selectedPatient.patientId})
              </h3>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <div className={styles.tabContainer}>
              <button
                className={`${styles.tabButton} ${activeTab === "info" ? styles.active : ""}`}
                onClick={() => setActiveTab("info")}
              >
                기본 정보
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === "history" ? styles.active : ""}`}
                onClick={() => setActiveTab("history")}
              >
                진료 기록
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === "appointments" ? styles.active : ""}`}
                onClick={() => setActiveTab("appointments")}
              >
                예약 내역
              </button>
            </div>

            <div className={styles.modalBody}>
              {activeTab === "info" && (
                <div className={styles.infoSection}>
                  {!isEditing ? (
                    <div className={styles.infoGrid}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>환자번호:</span>
                        <span className={styles.infoValue}>{selectedPatient.patientId}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>이름:</span>
                        <span className={styles.infoValue}>{selectedPatient.name}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>생년월일:</span>
                        <span className={styles.infoValue}>
                          {selectedPatient.birthDate} ({calculateAge(selectedPatient.birthDate)}세)
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>성별:</span>
                        <span className={styles.infoValue}>{selectedPatient.gender}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>연락처:</span>
                        <span className={styles.infoValue}>{selectedPatient.phone}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>등록일:</span>
                        <span className={styles.infoValue}>{selectedPatient.registrationDate}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>최근 방문일:</span>
                        <span className={styles.infoValue}>{selectedPatient.lastVisitDate}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>총 방문 횟수:</span>
                        <span className={styles.infoValue}>{selectedPatient.totalVisits}회</span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.infoGrid}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>환자번호:</span>
                        <span className={styles.infoValue}>{selectedPatient.patientId}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>이름:</span>
                        <input
                          type="text"
                          className={styles.infoInput}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>생년월일:</span>
                        <input
                          type="date"
                          className={styles.infoInput}
                          value={editForm.date_of_birth}
                          onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                        />
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>성별:</span>
                        <select
                          className={styles.infoInput}
                          value={editForm.gender}
                          onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as 'M' | 'F' })}
                        >
                          <option value="">선택</option>
                          <option value="M">남</option>
                          <option value="F">여</option>
                        </select>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>연락처:</span>
                        <input
                          type="tel"
                          className={styles.infoInput}
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>등록일:</span>
                        <span className={styles.infoValue}>{selectedPatient.registrationDate}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>최근 방문일:</span>
                        <span className={styles.infoValue}>{selectedPatient.lastVisitDate}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>총 방문 횟수:</span>
                        <span className={styles.infoValue}>{selectedPatient.totalVisits}회</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className={styles.historySection}>
                  {medicalHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      진료 기록이 없습니다.
                    </div>
                  ) : (
                    medicalHistory.map(record => (
                      <div key={record.id} className={styles.historyCard}>
                        <div className={styles.historyHeader}>
                          <span className={styles.historyDate}>{record.date}</span>
                          <span className={styles.historyDoctor}>
                            {record.doctor} ({record.department})
                          </span>
                          {record.questionnaireStatus && (
                            <span
                              style={{
                                fontSize: '0.85em',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                backgroundColor: record.questionnaireStatus === '완료' ? '#4CAF50' : '#9E9E9E',
                                color: 'white',
                                marginLeft: '8px'
                              }}
                            >
                              문진표: {record.questionnaireStatus}
                            </span>
                          )}
                        </div>
                        <div className={styles.historyBody}>
                          <div className={styles.historyRow}>
                            <span className={styles.historyLabel}>진단:</span>
                            <span className={styles.historyValue}>{record.diagnosis}</span>
                          </div>
                          <div className={styles.historyRow}>
                            <span className={styles.historyLabel}>치료:</span>
                            <span className={styles.historyValue}>{record.treatment}</span>
                          </div>

                          {record.questionnaireData && (
                            <details style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                              <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#495057' }}>
                                문진표 보기
                              </summary>
                              <div style={{ marginTop: '10px', paddingLeft: '10px' }}>
                                <div className={styles.historyRow}>
                                  <span className={styles.historyLabel}>주 증상:</span>
                                  <span className={styles.historyValue}>{record.questionnaireData.chief_complaint || 'N/A'}</span>
                                </div>
                                <div className={styles.historyRow}>
                                  <span className={styles.historyLabel}>증상 기간:</span>
                                  <span className={styles.historyValue}>{record.questionnaireData.symptom_duration || 'N/A'}</span>
                                </div>
                                <div className={styles.historyRow}>
                                  <span className={styles.historyLabel}>통증 정도:</span>
                                  <span className={styles.historyValue}>{record.questionnaireData.pain_level || 0}/10</span>
                                </div>
                                {record.questionnaireData.medications && (
                                  <div className={styles.historyRow}>
                                    <span className={styles.historyLabel}>복용약물:</span>
                                    <span className={styles.historyValue}>{record.questionnaireData.medications}</span>
                                  </div>
                                )}
                                {record.questionnaireData.allergies && (
                                  <div className={styles.historyRow}>
                                    <span className={styles.historyLabel}>알레르기:</span>
                                    <span className={styles.historyValue}>{record.questionnaireData.allergies}</span>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "appointments" && (
                <div className={styles.appointmentSection}>
                  {appointments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      예약 내역이 없습니다.
                    </div>
                  ) : (
                    appointments.map(appointment => (
                      <div key={appointment.id} className={styles.appointmentCard}>
                        <div className={styles.appointmentHeader}>
                          <div className={styles.appointmentDateTime}>
                            <span className={styles.appointmentDate}>{appointment.date}</span>
                            <span className={styles.appointmentTime}>{appointment.time}</span>
                          </div>
                          <span className={`${styles.appointmentStatus} ${styles[appointment.status]}`}>
                            {appointment.status}
                          </span>
                        </div>
                        <div className={styles.appointmentBody}>
                          <span className={styles.appointmentDoctor}>
                            {appointment.doctor} ({appointment.department})
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {activeTab === "info" && !isEditing && (
                <button className={styles.editBtn} onClick={handleEditToggle}>
                  수정
                </button>
              )}
              {activeTab === "info" && isEditing && (
                <>
                  <button className={styles.saveBtn} onClick={handleSavePatient}>
                    저장
                  </button>
                  <button className={styles.cancelEditBtn} onClick={handleEditToggle}>
                    취소
                  </button>
                </>
              )}
              <button className={styles.modalCloseBtn} onClick={handleCloseModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 문진표 작성 모달 */}
      <QuestionnaireModal
        isOpen={isQuestionnaireModalOpen}
        patient={questionnairePatient ? {
          id: questionnairePatient.id,
          name: questionnairePatient.name,
          birthDate: questionnairePatient.birthDate,
          gender: questionnairePatient.gender,
        } : null}
        onClose={() => {
          setIsQuestionnaireModalOpen(false);
          setQuestionnairePatient(null);
        }}
        onSubmit={handleQuestionnaireSubmit}
      />

      {/* 액션 모달들 */}
      <VitalMeasurementModal
        isOpen={isVitalModalOpen}
        patient={selectedForAction}
        onClose={() => setIsVitalModalOpen(false)}
        onSubmit={handleVitalSubmit}
      />

      <PhysicalExamModal
        isOpen={isPhysicalModalOpen}
        patient={selectedForAction}
        onClose={() => setIsPhysicalModalOpen(false)}
        onSubmit={handlePhysicalSubmit}
      />
    </div>
  );
};

export default PatientManagementPage;
