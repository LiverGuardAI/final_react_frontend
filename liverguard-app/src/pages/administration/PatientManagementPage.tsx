import React, { useState, useEffect } from "react";
import styles from "./PatientManagementPage.module.css";
import { getPatients, getEncounters, getAppointments, createQuestionnaire } from "../../api/administration_api";
import QuestionnaireModal, { type QuestionnaireData } from "../../components/administration/QuestionnaireModal";

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
  const [activeTab, setActiveTab] = useState<"info" | "history" | "appointments" | "questionnaire">("info");

  // 진료 기록 및 예약 데이터
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);

  // 문진표 모달
  const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
  const [questionnairePatient, setQuestionnairePatient] = useState<Patient | null>(null);

  // 환자 목록 로드
  const fetchPatientList = async (search?: string) => {
    setIsLoading(true);
    try {
      const response = await getPatients(search);

      // API 응답을 UI 형식으로 변환
      const formattedPatients: Patient[] = response.results.map((p: any) => ({
        id: p.patient_id,
        patientId: p.patient_id,
        name: p.name,
        birthDate: p.date_of_birth || 'N/A',
        gender: p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : 'N/A',
        phone: p.phone || 'N/A',
        registrationDate: p.created_at ? p.created_at.split('T')[0] : 'N/A',
        lastVisitDate: 'N/A', // 나중에 계산
        totalVisits: 0, // 나중에 계산
        status: mapStatus(p.current_status),
      }));

      setPatients(formattedPatients);
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

    // 진료 기록 조회
    try {
      const encountersData = await getEncounters(patient.patientId);
      const formattedHistory: MedicalHistory[] = encountersData.results.map((e: any) => ({
        id: e.encounter_id,
        date: e.encounter_date,
        doctor: e.doctor_name || 'N/A',
        department: e.department || 'N/A',
        diagnosis: e.clinical_notes || '진료 중',
        treatment: e.encounter_status === 'COMPLETED' ? '완료' : '진행 중',
        prescription: undefined,
      }));
      setMedicalHistory(formattedHistory);

      // 통계 업데이트
      setPatients(prev => prev.map(p => p.id === patient.id ? {
        ...p,
        totalVisits: formattedHistory.length,
        lastVisitDate: formattedHistory.length > 0 ? formattedHistory[0].date : 'N/A'
      } : p));

      // 문진표 파싱
      const questionnaireList = encountersData.results
        .filter((e: any) => {
          try {
            JSON.parse(e.chief_complaint);
            return true;
          } catch {
            return false;
          }
        })
        .map((e: any) => ({
          id: e.encounter_id,
          date: e.encounter_date,
          data: JSON.parse(e.chief_complaint),
        }));
      setQuestionnaires(questionnaireList);
    } catch (error) {
      console.error('진료 기록 조회 실패:', error);
    }

    // 예약 내역 조회
    try {
      const appointmentsData = await getAppointments({ patient_id: patient.patientId });
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
      console.error('예약 내역 조회 실패:', error);
    }
  };

  const handleCloseModal = () => {
    setSelectedPatient(null);
    setActiveTab("info");
  };

  const handleOpenQuestionnaire = (patient: Patient) => {
    setQuestionnairePatient(patient);
    setIsQuestionnaireModalOpen(true);
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
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          className={styles.questionnaireBtn}
                          onClick={() => handleOpenQuestionnaire(patient)}
                          title="문진표 작성"
                        >
                          문진표
                        </button>
                        <button
                          className={styles.detailBtn}
                          onClick={() => handleViewDetails(patient)}
                        >
                          상세보기
                        </button>
                      </div>
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
                className={`${styles.tabButton} ${activeTab === "questionnaire" ? styles.active : ""}`}
                onClick={() => setActiveTab("questionnaire")}
              >
                문진표
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
                </div>
              )}

              {activeTab === "questionnaire" && (
                <div className={styles.questionnaireSection}>
                  {questionnaires.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      작성된 문진표가 없습니다.
                      <div style={{ marginTop: '20px' }}>
                        <button
                          className={styles.detailBtn}
                          onClick={() => handleOpenQuestionnaire(selectedPatient)}
                        >
                          문진표 작성하기
                        </button>
                      </div>
                    </div>
                  ) : (
                    questionnaires.map((q) => (
                      <div key={q.id} className={styles.questionnaireCard}>
                        <div className={styles.questionnaireHeader}>
                          <h4 className={styles.questionnaireTitle}>간 질환 문진표</h4>
                          <span className={styles.questionnaireDate}>작성일: {q.date}</span>
                        </div>
                        <div className={styles.questionSection}>
                          <div className={styles.sectionTitle}>주 호소 (Chief Complaint)</div>
                          <div className={styles.questionContent}>
                            <p className={styles.questionText}>{q.data.chief_complaint || 'N/A'}</p>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>증상 지속 기간:</span>
                              <span className={styles.infoValue}>{q.data.symptom_duration || 'N/A'}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>통증 정도 (0-10):</span>
                              <span className={styles.infoValue}>{q.data.pain_level}/10</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
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
