import React, { useState, useEffect } from "react";
import styles from "./PatientManagementPage.module.css";
import { getPatients, getEncounters, getAppointments, createQuestionnaire } from "../../api/administration_api";
import { updatePatient, type PatientUpdateData } from "../../api/administrationApi";
import QuestionnaireModal, { type QuestionnaireData } from "../../components/administration/QuestionnaireModal";
import { useWebSocket } from "../../hooks/useWebSocket";

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
  status: "활성" | "휴면" | "탈퇴";
}

interface MedicalHistory {
  id: number;
  date: string;
  doctor: string;
  department: string;
  diagnosis: string;
  treatment: string;
  prescription?: string;
  questionnaireData?: any;
  questionnaireStatus?: string;
}

interface Appointment {
  id: number;
  date: string;
  time: string;
  doctor: string;
  department: string;
  status: "예정" | "완료" | "취소";
}

const PatientManagementPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"전체" | "활성" | "휴면" | "탈퇴">("전체");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "history" | "appointments">("info");

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

  // 환자 목록 로드
  const fetchPatientList = async (search?: string) => {
    setIsLoading(true);
    try {
      const response = await getPatients(search);

      // 각 환자의 진료 기록을 병렬로 조회 (통계 계산용)
      const patientsWithStats = await Promise.all(
        response.results.map(async (p: any) => {
          try {
            const encountersData = await getEncounters(p.patient_id);
            const encounters = encountersData.results || [];
            const completedEncounters = encounters.filter((e: any) => e.encounter_status === 'COMPLETED');

            return {
              id: p.patient_id,
              patientId: p.patient_id,
              name: p.name,
              birthDate: p.date_of_birth || 'N/A',
              gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : 'N/A',
              phone: p.phone || 'N/A',
              registrationDate: p.created_at ? p.created_at.split('T')[0] : 'N/A',
              lastVisitDate: completedEncounters.length > 0
                ? completedEncounters[0].encounter_date
                : 'N/A',
              totalVisits: completedEncounters.length,
              status: mapStatus(p.current_status),
            };
          } catch (error) {
            // 개별 환자 조회 실패해도 계속 진행
            return {
              id: p.patient_id,
              patientId: p.patient_id,
              name: p.name,
              birthDate: p.date_of_birth || 'N/A',
              gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : 'N/A',
              phone: p.phone || 'N/A',
              registrationDate: p.created_at ? p.created_at.split('T')[0] : 'N/A',
              lastVisitDate: 'N/A',
              totalVisits: 0,
              status: mapStatus(p.current_status),
            };
          }
        })
      );

      setPatients(patientsWithStats);
    } catch (error) {
      console.error('환자 목록 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 환자 상태 매핑
  const mapStatus = (currentStatus: string): "활성" | "휴면" | "탈퇴" => {
    if (currentStatus === 'REGISTERED' || currentStatus === 'WAITING_CLINIC' || currentStatus === 'IN_CLINIC') {
      return '활성';
    }
    return '휴면';
  };

  // 나이 계산
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

  // 웹소켓 연결 (실시간 업데이트)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  const WS_URL = `${protocol}//${hostname}:8000/ws/clinic/`;

  useWebSocket(WS_URL, {
    onMessage: (data: any) => {
      if (data.type === 'queue_update' || data.type === 'patient_update') {
        console.log("🔔 환자 정보 업데이트:", data.message);
        // 환자 목록 새로고침
        fetchPatientList(searchTerm);
      }
    },
  });

  useEffect(() => {
    fetchPatientList();
  }, []);

  const filteredPatients = patients.filter(patient => {
    const matchesSearch =
      patient.name.includes(searchTerm) ||
      patient.patientId.includes(searchTerm) ||
      patient.phone.includes(searchTerm);
    const matchesStatus = filterStatus === "전체" || patient.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("info");
    setIsEditing(false);

    // 편집 폼 초기화
    setEditForm({
      name: patient.name,
      date_of_birth: patient.birthDate,
      gender: patient.gender === '남' ? 'M' : patient.gender === '여' ? 'F' : '',
      phone: patient.phone,
    });

    // 데이터가 이미 로드되어 있으면 API 호출 생략
    if (medicalHistory.length > 0 && selectedPatient?.id === patient.id) {
      return;
    }

    // 병렬로 API 호출하여 속도 개선
    try {
      const [encountersData, appointmentsData] = await Promise.all([
        getEncounters(patient.patientId),
        getAppointments({ patient_id: patient.patientId })
      ]);

      // 진료 기록 포맷팅 (문진표 데이터 포함)
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

      // 통계 업데이트
      setPatients(prev => prev.map(p => p.id === patient.id ? {
        ...p,
        totalVisits: formattedHistory.length,
        lastVisitDate: formattedHistory.length > 0 ? formattedHistory[0].date : 'N/A'
      } : p));

      // 예약 내역 포맷팅
      const formattedAppointments: Appointment[] = appointmentsData.results.map((a: any) => ({
        id: a.appointment_id,
        date: a.appointment_date,
        time: a.appointment_time,
        doctor: a.doctor_name || 'N/A',
        department: a.department || 'N/A',
        status: a.status === 'CONFIRMED' || a.status === '승인완료' ? '예정' :
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

      // 로컬 상태 업데이트
      const updatedPatient = {
        ...selectedPatient,
        name: editForm.name,
        birthDate: editForm.date_of_birth,
        gender: editForm.gender === 'M' ? '남' : '여',
        phone: editForm.phone,
      };
      setSelectedPatient(updatedPatient);

      // 환자 목록도 업데이트
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
      await createQuestionnaire(data);
      alert('문진표가 제출되었습니다.');
      setIsQuestionnaireModalOpen(false);
      setQuestionnairePatient(null);

      // 목록 새로고침
      if (selectedPatient) {
        handleViewDetails(selectedPatient);
      }
    } catch (error: any) {
      console.error('문진표 제출 실패:', error);
      alert(error.response?.data?.message || '문진표 제출 중 오류가 발생했습니다.');
    }
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
          <div className={styles.statBox}>
            <span className={styles.statLabel}>활성</span>
            <span className={styles.statValue}>
              {patients.filter(p => p.status === "활성").length}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>휴면</span>
            <span className={styles.statValue}>
              {patients.filter(p => p.status === "휴면").length}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="환자명, 환자번호, 연락처로 검색"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              if (e.target.value.length > 0) {
                fetchPatientList(e.target.value);
              } else {
                fetchPatientList();
              }
            }}
          />
        </div>
        <div className={styles.filterBox}>
          <label className={styles.filterLabel}>상태:</label>
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="전체">전체</option>
            <option value="활성">활성</option>
            <option value="휴면">휴면</option>
            <option value="탈퇴">탈퇴</option>
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>환자 목록을 불러오는 중...</div>
        ) : (
          <table className={styles.patientTable}>
            <thead>
              <tr>
                <th>환자번호</th>
                <th>이름</th>
                <th>생년월일</th>
                <th>나이</th>
                <th>성별</th>
                <th>연락처</th>
                <th>최근 방문일</th>
                <th>총 방문 횟수</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredPatients.map(patient => (
                  <tr key={patient.id}>
                    <td>{patient.patientId}</td>
                    <td className={styles.patientName}>{patient.name}</td>
                    <td>{patient.birthDate}</td>
                    <td>{calculateAge(patient.birthDate)}세</td>
                    <td>{patient.gender}</td>
                    <td>{patient.phone}</td>
                    <td>{patient.lastVisitDate}</td>
                    <td>{patient.totalVisits}회</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[patient.status]}`}>
                        {patient.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.detailBtn}
                        onClick={() => handleViewDetails(patient)}
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
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>상태:</span>
                        <span className={styles.infoValue}>
                          <span className={`${styles.statusBadge} ${styles[selectedPatient.status]}`}>
                            {selectedPatient.status}
                          </span>
                        </span>
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
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>상태:</span>
                        <span className={styles.infoValue}>
                          <span className={`${styles.statusBadge} ${styles[selectedPatient.status]}`}>
                            {selectedPatient.status}
                          </span>
                        </span>
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

                          {/* 문진표 데이터가 있으면 표시 */}
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
    </div>
  );
};

export default PatientManagementPage;
