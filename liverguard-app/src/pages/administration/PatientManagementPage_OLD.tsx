// src/pages/administration/PatientManagementPage.tsx
import React, { useState } from "react";
import styles from "./PatientManagementPage.module.css";

interface Patient {
  id: number;
  patientId: string;
  name: string;
  birthDate: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
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

interface MedicalQuestionnaire {
  id: number;
  patientId: string;
  patientName: string;
  date: string;
  chiefComplaint: string;
  symptomDuration: string;
  painLevel: number;
  symptoms: {
    abdominalPain: boolean;
    nausea: boolean;
    vomiting: boolean;
    diarrhea: boolean;
    constipation: boolean;
    bloating: boolean;
    appetiteLoss: boolean;
    weightLoss: boolean;
    fatigue: boolean;
    jaundice: boolean;
    fever: boolean;
    other: string;
  };
  medicalHistory: {
    hepatitis: boolean;
    cirrhosis: boolean;
    diabetes: boolean;
    hypertension: boolean;
    cancer: boolean;
    other: string;
  };
  familyHistory: string;
  medications: string;
  allergies: string;
  smoking: "none" | "past" | "current";
  alcohol: "none" | "occasional" | "regular" | "heavy";
  additionalNotes: string;
}

const PatientManagementPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([
    {
      id: 1,
      patientId: "P2024001",
      name: "김철수",
      birthDate: "1979-05-15",
      gender: "남",
      phone: "010-1234-5678",
      email: "kim.cs@email.com",
      address: "서울시 강남구 테헤란로 123",
      emergencyContact: "김영희",
      emergencyPhone: "010-1234-5679",
      registrationDate: "2023-03-10",
      lastVisitDate: "2024-12-20",
      totalVisits: 15,
      status: "활성",
    },
    {
      id: 2,
      patientId: "P2024045",
      name: "이영희",
      birthDate: "1972-08-22",
      gender: "여",
      phone: "010-2345-6789",
      email: "lee.yh@email.com",
      address: "서울시 서초구 서초대로 456",
      emergencyContact: "이철수",
      emergencyPhone: "010-2345-6780",
      registrationDate: "2023-07-22",
      lastVisitDate: "2024-12-21",
      totalVisits: 8,
      status: "활성",
    },
    {
      id: 3,
      patientId: "P2024023",
      name: "박민수",
      birthDate: "1986-11-30",
      gender: "남",
      phone: "010-3456-7890",
      email: "park.ms@email.com",
      address: "서울시 송파구 올림픽로 789",
      emergencyContact: "박지영",
      emergencyPhone: "010-3456-7891",
      registrationDate: "2023-05-18",
      lastVisitDate: "2024-12-21",
      totalVisits: 12,
      status: "활성",
    },
    {
      id: 4,
      patientId: "P2024067",
      name: "정수연",
      birthDate: "1964-02-14",
      gender: "여",
      phone: "010-4567-8901",
      email: "jung.sy@email.com",
      address: "서울시 마포구 마포대로 321",
      emergencyContact: "정민호",
      emergencyPhone: "010-4567-8902",
      registrationDate: "2023-09-05",
      lastVisitDate: "2024-12-22",
      totalVisits: 20,
      status: "활성",
    },
    {
      id: 5,
      patientId: "P2023156",
      name: "최동욱",
      birthDate: "1990-07-08",
      gender: "남",
      phone: "010-5678-9012",
      email: "choi.du@email.com",
      address: "경기도 성남시 분당구 판교로 654",
      emergencyContact: "최은정",
      emergencyPhone: "010-5678-9013",
      registrationDate: "2022-11-20",
      lastVisitDate: "2024-06-15",
      totalVisits: 5,
      status: "휴면",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"전체" | "활성" | "휴면" | "탈퇴">("전체");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "history" | "appointments" | "questionnaire">("info");

  // 샘플 문진표 데이터
  const sampleQuestionnaire: MedicalQuestionnaire = {
    id: 1,
    patientId: "P2024001",
    patientName: "김철수",
    date: "2024-12-20",
    chiefComplaint: "우측 상복부 불편감 및 지속적인 피로감",
    symptomDuration: "2주",
    painLevel: 5,
    symptoms: {
      abdominalPain: true,
      nausea: false,
      vomiting: false,
      diarrhea: false,
      constipation: true,
      bloating: true,
      appetiteLoss: true,
      weightLoss: false,
      fatigue: true,
      jaundice: false,
      fever: false,
      other: "소화불량 증상",
    },
    medicalHistory: {
      hepatitis: false,
      cirrhosis: false,
      diabetes: false,
      hypertension: true,
      cancer: false,
      other: "위염 과거력",
    },
    familyHistory: "부친 - 간경화, 모친 - 당뇨",
    medications: "혈압약 (아모디핀 5mg), 소화제",
    allergies: "페니실린 알레르기",
    smoking: "past",
    alcohol: "occasional",
    additionalNotes: "최근 업무 스트레스가 많음. 식사 불규칙.",
  };

  // 샘플 진료 기록
  const sampleMedicalHistory: MedicalHistory[] = [
    {
      id: 1,
      date: "2024-12-20",
      doctor: "정예진",
      department: "소화기내과",
      diagnosis: "만성 간염",
      treatment: "약물 치료",
      prescription: "간장약, 소화제",
    },
    {
      id: 2,
      date: "2024-11-15",
      doctor: "송영운",
      department: "소화기내과",
      diagnosis: "위염",
      treatment: "위내시경 검사 및 약물 치료",
      prescription: "위장약",
    },
    {
      id: 3,
      date: "2024-10-10",
      doctor: "정예진",
      department: "소화기내과",
      diagnosis: "정기 검진",
      treatment: "혈액 검사",
    },
  ];

  // 샘플 예약 내역
  const sampleAppointments: Appointment[] = [
    {
      id: 1,
      date: "2024-12-25",
      time: "10:00",
      doctor: "정예진",
      department: "소화기내과",
      status: "예정",
    },
    {
      id: 2,
      date: "2024-12-20",
      time: "14:30",
      doctor: "정예진",
      department: "소화기내과",
      status: "완료",
    },
    {
      id: 3,
      date: "2024-11-15",
      time: "09:00",
      doctor: "송영운",
      department: "소화기내과",
      status: "완료",
    },
  ];

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch =
      patient.name.includes(searchTerm) ||
      patient.patientId.includes(searchTerm) ||
      patient.phone.includes(searchTerm);
    const matchesStatus = filterStatus === "전체" || patient.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("info");
  };

  const handleCloseModal = () => {
    setSelectedPatient(null);
    setActiveTab("info");
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
            onChange={e => setSearchTerm(e.target.value)}
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
            {filteredPatients.map(patient => (
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
            ))}
          </tbody>
        </table>
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
                      <span className={styles.infoLabel}>이메일:</span>
                      <span className={styles.infoValue}>{selectedPatient.email}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>주소:</span>
                      <span className={styles.infoValue}>{selectedPatient.address}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>비상 연락처:</span>
                      <span className={styles.infoValue}>
                        {selectedPatient.emergencyContact} ({selectedPatient.emergencyPhone})
                      </span>
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
                  <div className={styles.questionnaireHeader}>
                    <h4 className={styles.questionnaireTitle}>간 질환 문진표</h4>
                    <span className={styles.questionnaireDate}>작성일: {sampleQuestionnaire.date}</span>
                  </div>

                  {/* 주 호소 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>주 호소 (Chief Complaint)</div>
                    <div className={styles.questionContent}>
                      <p className={styles.questionText}>{sampleQuestionnaire.chiefComplaint}</p>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>증상 지속 기간:</span>
                        <span className={styles.infoValue}>{sampleQuestionnaire.symptomDuration}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>통증 정도 (0-10):</span>
                        <span className={styles.infoValue}>
                          <div className={styles.painLevelBar}>
                            <div
                              className={styles.painLevelFill}
                              style={{ width: `${sampleQuestionnaire.painLevel * 10}%` }}
                            />
                            <span className={styles.painLevelText}>{sampleQuestionnaire.painLevel}/10</span>
                          </div>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 현재 증상 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>현재 증상 (Current Symptoms)</div>
                    <div className={styles.questionContent}>
                      <div className={styles.symptomGrid}>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.abdominalPain ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.abdominalPain ? '☑' : '☐'}</span>
                          <span>복통</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.nausea ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.nausea ? '☑' : '☐'}</span>
                          <span>오심</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.vomiting ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.vomiting ? '☑' : '☐'}</span>
                          <span>구토</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.diarrhea ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.diarrhea ? '☑' : '☐'}</span>
                          <span>설사</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.constipation ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.constipation ? '☑' : '☐'}</span>
                          <span>변비</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.bloating ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.bloating ? '☑' : '☐'}</span>
                          <span>복부팽만감</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.appetiteLoss ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.appetiteLoss ? '☑' : '☐'}</span>
                          <span>식욕부진</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.weightLoss ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.weightLoss ? '☑' : '☐'}</span>
                          <span>체중감소</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.fatigue ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.fatigue ? '☑' : '☐'}</span>
                          <span>피로감</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.jaundice ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.jaundice ? '☑' : '☐'}</span>
                          <span>황달</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.symptoms.fever ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.symptoms.fever ? '☑' : '☐'}</span>
                          <span>발열</span>
                        </div>
                      </div>
                      {sampleQuestionnaire.symptoms.other && (
                        <div className={styles.otherSymptom}>
                          <span className={styles.infoLabel}>기타 증상:</span>
                          <span className={styles.infoValue}>{sampleQuestionnaire.symptoms.other}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 과거 병력 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>과거 병력 (Medical History)</div>
                    <div className={styles.questionContent}>
                      <div className={styles.symptomGrid}>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.medicalHistory.hepatitis ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.medicalHistory.hepatitis ? '☑' : '☐'}</span>
                          <span>간염</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.medicalHistory.cirrhosis ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.medicalHistory.cirrhosis ? '☑' : '☐'}</span>
                          <span>간경화</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.medicalHistory.diabetes ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.medicalHistory.diabetes ? '☑' : '☐'}</span>
                          <span>당뇨</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.medicalHistory.hypertension ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.medicalHistory.hypertension ? '☑' : '☐'}</span>
                          <span>고혈압</span>
                        </div>
                        <div className={`${styles.symptomItem} ${sampleQuestionnaire.medicalHistory.cancer ? styles.checked : ''}`}>
                          <span className={styles.checkbox}>{sampleQuestionnaire.medicalHistory.cancer ? '☑' : '☐'}</span>
                          <span>암</span>
                        </div>
                      </div>
                      {sampleQuestionnaire.medicalHistory.other && (
                        <div className={styles.otherSymptom}>
                          <span className={styles.infoLabel}>기타 병력:</span>
                          <span className={styles.infoValue}>{sampleQuestionnaire.medicalHistory.other}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 가족력 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>가족력 (Family History)</div>
                    <div className={styles.questionContent}>
                      <p className={styles.questionText}>{sampleQuestionnaire.familyHistory}</p>
                    </div>
                  </div>

                  {/* 복용 약물 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>현재 복용 중인 약물 (Current Medications)</div>
                    <div className={styles.questionContent}>
                      <p className={styles.questionText}>{sampleQuestionnaire.medications}</p>
                    </div>
                  </div>

                  {/* 알레르기 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>알레르기 (Allergies)</div>
                    <div className={styles.questionContent}>
                      <p className={styles.questionText}>{sampleQuestionnaire.allergies}</p>
                    </div>
                  </div>

                  {/* 생활 습관 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>생활 습관 (Lifestyle)</div>
                    <div className={styles.questionContent}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>흡연:</span>
                        <span className={styles.infoValue}>
                          <span className={`${styles.lifestyleBadge} ${styles[sampleQuestionnaire.smoking]}`}>
                            {sampleQuestionnaire.smoking === 'none' ? '비흡연' :
                             sampleQuestionnaire.smoking === 'past' ? '과거 흡연' : '현재 흡연'}
                          </span>
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>음주:</span>
                        <span className={styles.infoValue}>
                          <span className={`${styles.lifestyleBadge} ${styles[sampleQuestionnaire.alcohol]}`}>
                            {sampleQuestionnaire.alcohol === 'none' ? '금주' :
                             sampleQuestionnaire.alcohol === 'occasional' ? '가끔' :
                             sampleQuestionnaire.alcohol === 'regular' ? '정기적' : '과음'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 추가 사항 */}
                  <div className={styles.questionSection}>
                    <div className={styles.sectionTitle}>추가 사항 (Additional Notes)</div>
                    <div className={styles.questionContent}>
                      <p className={styles.questionText}>{sampleQuestionnaire.additionalNotes}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className={styles.historySection}>
                  {sampleMedicalHistory.map(record => (
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
                        {record.prescription && (
                          <div className={styles.historyRow}>
                            <span className={styles.historyLabel}>처방:</span>
                            <span className={styles.historyValue}>{record.prescription}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "appointments" && (
                <div className={styles.appointmentSection}>
                  {sampleAppointments.map(appointment => (
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
                  ))}
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
    </div>
  );
};

export default PatientManagementPage;
