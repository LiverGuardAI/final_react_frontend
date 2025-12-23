// src/pages/administration/QuestionnaireFormPage.tsx
import React, { useState } from "react";
import styles from "./QuestionnaireFormPage.module.css";

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "남" | "여";
  phone: string;
  birthDate: string;
}

interface QuestionnaireListItem {
  id: number;
  date: string;
  chiefComplaint: string;
  status: "작성중" | "완료";
}

const QuestionnaireFormPage: React.FC = () => {
  // Stage 1: Patient selection
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Stage 2: Questionnaire list or Stage 3: Form
  const [showForm, setShowForm] = useState(false);

  // Mock patient data - 실제로는 API에서 가져옴
  const allPatients: Patient[] = [
    { id: "P2024001", name: "김철수", age: 45, gender: "남", phone: "010-1234-5678", birthDate: "1978-03-15" },
    { id: "P2024002", name: "이영희", age: 38, gender: "여", phone: "010-2345-6789", birthDate: "1985-07-22" },
    { id: "P2024003", name: "박민수", age: 52, gender: "남", phone: "010-3456-7890", birthDate: "1971-11-08" },
    { id: "P2024004", name: "최지은", age: 29, gender: "여", phone: "010-4567-8901", birthDate: "1994-05-30" },
    { id: "P2024005", name: "정승호", age: 61, gender: "남", phone: "010-5678-9012", birthDate: "1962-09-18" },
  ];

  // Mock questionnaire list - 실제로는 API에서 선택된 환자의 문진표 목록을 가져옴
  const getPatientQuestionnaires = (patientId: string): QuestionnaireListItem[] => {
    if (patientId === "P2024001") {
      return [
        { id: 1, date: "2024-12-20", chiefComplaint: "우측 상복부 불편감 및 지속적인 피로감", status: "완료" },
        { id: 2, date: "2024-11-15", chiefComplaint: "복부 팽만감 및 소화불량", status: "완료" },
        { id: 3, date: "2024-10-08", chiefComplaint: "간 기능 검사 이상 소견", status: "완료" },
      ];
    } else if (patientId === "P2024002") {
      return [
        { id: 4, date: "2024-12-18", chiefComplaint: "만성 피로 및 식욕부진", status: "완료" },
      ];
    }
    return [];
  };

  const filteredPatients = allPatients.filter(patient =>
    patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.name.includes(searchQuery) ||
    patient.phone.includes(searchQuery)
  );

  // Stage 2: Questionnaire form data
  const [formData, setFormData] = useState({
    // 주 호소
    chiefComplaint: "",
    symptomDuration: "",
    painLevel: 0,

    // 현재 증상
    symptoms: {
      abdominalPain: false,
      nausea: false,
      vomiting: false,
      diarrhea: false,
      constipation: false,
      bloating: false,
      appetiteLoss: false,
      weightLoss: false,
      fatigue: false,
      jaundice: false,
      fever: false,
      other: "",
    },

    // 과거 병력
    medicalHistory: {
      hepatitis: false,
      cirrhosis: false,
      diabetes: false,
      hypertension: false,
      cancer: false,
      other: "",
    },

    // 기타 정보
    familyHistory: "",
    medications: "",
    allergies: "",
    smoking: "none" as "none" | "past" | "current",
    alcohol: "none" as "none" | "occasional" | "regular" | "heavy",
    additionalNotes: "",
  });

  const handleSymptomChange = (symptom: keyof typeof formData.symptoms) => {
    if (symptom === "other") return;
    setFormData(prev => ({
      ...prev,
      symptoms: {
        ...prev.symptoms,
        [symptom]: !prev.symptoms[symptom],
      },
    }));
  };

  const handleMedicalHistoryChange = (condition: keyof typeof formData.medicalHistory) => {
    if (condition === "other") return;
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        [condition]: !prev.medicalHistory[condition],
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("문진표 제출:", { patient: selectedPatient, formData });
    alert("문진표가 성공적으로 제출되었습니다!");
    // 제출 후 폼 닫고 목록으로 돌아가기
    setShowForm(false);
    setFormData({
      chiefComplaint: "",
      symptomDuration: "",
      painLevel: 0,
      symptoms: {
        abdominalPain: false,
        nausea: false,
        vomiting: false,
        diarrhea: false,
        constipation: false,
        bloating: false,
        appetiteLoss: false,
        weightLoss: false,
        fatigue: false,
        jaundice: false,
        fever: false,
        other: "",
      },
      medicalHistory: {
        hepatitis: false,
        cirrhosis: false,
        diabetes: false,
        hypertension: false,
        cancer: false,
        other: "",
      },
      familyHistory: "",
      medications: "",
      allergies: "",
      smoking: "none",
      alcohol: "none",
      additionalNotes: "",
    });
  };

  const handleBackToPatientList = () => {
    setSelectedPatient(null);
    setShowForm(false);
  };

  const handleBackToQuestionnaireList = () => {
    setShowForm(false);
  };

  // Stage 1: Patient Selection View
  if (!selectedPatient) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>문진표 작성 - 환자 선택</h2>
          <span className={styles.subtitle}>문진표를 작성할 환자를 선택해주세요</span>
        </div>

        <div className={styles.patientSelectionSection}>
          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="환자번호, 이름, 연락처로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.patientListContainer}>
            {filteredPatients.length === 0 ? (
              <div className={styles.emptyState}>
                <p>검색 결과가 없습니다.</p>
              </div>
            ) : (
              <div className={styles.patientList}>
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={styles.patientCard}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <div className={styles.patientCardHeader}>
                      <span className={styles.patientCardName}>{patient.name}</span>
                      <span className={styles.patientCardId}>{patient.id}</span>
                    </div>
                    <div className={styles.patientCardInfo}>
                      <span>{patient.gender} / {patient.age}세</span>
                      <span>{patient.phone}</span>
                    </div>
                    <div className={styles.patientCardBirth}>
                      생년월일: {patient.birthDate}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Questionnaire List View
  if (selectedPatient && !showForm) {
    const questionnaires = getPatientQuestionnaires(selectedPatient.id);

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>{selectedPatient.name} 님의 문진표 목록</h2>
          <span className={styles.subtitle}>과거 작성된 문진표를 조회하거나 새 문진표를 작성하세요</span>
        </div>

        <div className={styles.questionnaireListSection}>
          {/* 환자 정보 요약 */}
          <div className={styles.patientInfoSummary}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>환자번호:</span>
              <span className={styles.infoValue}>{selectedPatient.id}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>환자명:</span>
              <span className={styles.infoValue}>{selectedPatient.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>성별/나이:</span>
              <span className={styles.infoValue}>{selectedPatient.gender} / {selectedPatient.age}세</span>
            </div>
            <div className={styles.actionButtonsTop}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={handleBackToPatientList}
              >
                ← 환자 목록으로
              </button>
              <button
                type="button"
                className={styles.newQuestionnaireBtn}
                onClick={() => setShowForm(true)}
              >
                + 새 문진표 작성
              </button>
            </div>
          </div>

          {/* 문진표 목록 */}
          <div className={styles.questionnaireListContainer}>
            {questionnaires.length === 0 ? (
              <div className={styles.emptyState}>
                <p>작성된 문진표가 없습니다.</p>
                <p>새 문진표를 작성해주세요.</p>
              </div>
            ) : (
              <div className={styles.questionnaireCards}>
                {questionnaires.map((questionnaire) => (
                  <div key={questionnaire.id} className={styles.questionnaireCard}>
                    <div className={styles.questionnaireCardHeader}>
                      <span className={styles.questionnaireDate}>{questionnaire.date}</span>
                      <span className={`${styles.questionnaireStatus} ${styles[questionnaire.status]}`}>
                        {questionnaire.status}
                      </span>
                    </div>
                    <div className={styles.questionnaireCardBody}>
                      <div className={styles.questionnaireCardLabel}>주 호소</div>
                      <div className={styles.questionnaireCardValue}>{questionnaire.chiefComplaint}</div>
                    </div>
                    <div className={styles.questionnaireCardFooter}>
                      <button className={styles.viewBtn}>상세보기</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Stage 3: Questionnaire Form View
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>간 질환 문진표 작성</h2>
        <span className={styles.subtitle}>환자의 증상 및 병력을 상세히 작성해주세요</span>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 선택된 환자 정보 표시 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>환자 정보</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.selectedPatientInfo}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>환자번호:</span>
                <span className={styles.infoValue}>{selectedPatient?.id}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>환자명:</span>
                <span className={styles.infoValue}>{selectedPatient?.name}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>성별/나이:</span>
                <span className={styles.infoValue}>{selectedPatient?.gender} / {selectedPatient?.age}세</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>연락처:</span>
                <span className={styles.infoValue}>{selectedPatient?.phone}</span>
              </div>
              <button
                type="button"
                className={styles.changePatientBtn}
                onClick={handleBackToQuestionnaireList}
              >
                ← 목록으로
              </button>
            </div>
          </div>
        </div>

        {/* 주 호소 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>주 호소 (Chief Complaint)</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.formGroup}>
              <label className={styles.label}>주 증상 *</label>
              <textarea
                className={styles.textarea}
                value={formData.chiefComplaint}
                onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                placeholder="예: 우측 상복부 불편감 및 지속적인 피로감"
                rows={3}
                required
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>증상 지속 기간 *</label>
                <input
                  type="text"
                  className={styles.input}
                  value={formData.symptomDuration}
                  onChange={(e) => setFormData({ ...formData, symptomDuration: e.target.value })}
                  placeholder="예: 2주, 1개월"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>통증 정도 (0-10)</label>
                <div className={styles.painLevelContainer}>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    className={styles.painSlider}
                    value={formData.painLevel}
                    onChange={(e) => setFormData({ ...formData, painLevel: parseInt(e.target.value) })}
                  />
                  <span className={styles.painValue}>{formData.painLevel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 현재 증상 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>현재 증상 (Current Symptoms)</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.checkboxGrid}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.abdominalPain}
                  onChange={() => handleSymptomChange("abdominalPain")}
                />
                <span>복통</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.nausea}
                  onChange={() => handleSymptomChange("nausea")}
                />
                <span>오심</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.vomiting}
                  onChange={() => handleSymptomChange("vomiting")}
                />
                <span>구토</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.diarrhea}
                  onChange={() => handleSymptomChange("diarrhea")}
                />
                <span>설사</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.constipation}
                  onChange={() => handleSymptomChange("constipation")}
                />
                <span>변비</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.bloating}
                  onChange={() => handleSymptomChange("bloating")}
                />
                <span>복부팽만감</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.appetiteLoss}
                  onChange={() => handleSymptomChange("appetiteLoss")}
                />
                <span>식욕부진</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.weightLoss}
                  onChange={() => handleSymptomChange("weightLoss")}
                />
                <span>체중감소</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.fatigue}
                  onChange={() => handleSymptomChange("fatigue")}
                />
                <span>피로감</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.jaundice}
                  onChange={() => handleSymptomChange("jaundice")}
                />
                <span>황달</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.symptoms.fever}
                  onChange={() => handleSymptomChange("fever")}
                />
                <span>발열</span>
              </label>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>기타 증상</label>
              <input
                type="text"
                className={styles.input}
                value={formData.symptoms.other}
                onChange={(e) => setFormData({
                  ...formData,
                  symptoms: { ...formData.symptoms, other: e.target.value }
                })}
                placeholder="기타 증상을 입력하세요"
              />
            </div>
          </div>
        </div>

        {/* 과거 병력 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>과거 병력 (Medical History)</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.checkboxGrid}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.medicalHistory.hepatitis}
                  onChange={() => handleMedicalHistoryChange("hepatitis")}
                />
                <span>간염</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.medicalHistory.cirrhosis}
                  onChange={() => handleMedicalHistoryChange("cirrhosis")}
                />
                <span>간경화</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.medicalHistory.diabetes}
                  onChange={() => handleMedicalHistoryChange("diabetes")}
                />
                <span>당뇨</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.medicalHistory.hypertension}
                  onChange={() => handleMedicalHistoryChange("hypertension")}
                />
                <span>고혈압</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.medicalHistory.cancer}
                  onChange={() => handleMedicalHistoryChange("cancer")}
                />
                <span>암</span>
              </label>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>기타 병력</label>
              <input
                type="text"
                className={styles.input}
                value={formData.medicalHistory.other}
                onChange={(e) => setFormData({
                  ...formData,
                  medicalHistory: { ...formData.medicalHistory, other: e.target.value }
                })}
                placeholder="기타 병력을 입력하세요"
              />
            </div>
          </div>
        </div>

        {/* 가족력, 약물, 알레르기 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>가족력 및 약물 정보</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.formGroup}>
              <label className={styles.label}>가족력</label>
              <textarea
                className={styles.textarea}
                value={formData.familyHistory}
                onChange={(e) => setFormData({ ...formData, familyHistory: e.target.value })}
                placeholder="예: 부친 - 간경화, 모친 - 당뇨"
                rows={2}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>현재 복용 중인 약물</label>
              <textarea
                className={styles.textarea}
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                placeholder="예: 혈압약 (아모디핀 5mg), 소화제"
                rows={2}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>알레르기</label>
              <input
                type="text"
                className={styles.input}
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="예: 페니실린 알레르기"
              />
            </div>
          </div>
        </div>

        {/* 생활 습관 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>생활 습관 (Lifestyle)</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>흡연</label>
                <select
                  className={styles.select}
                  value={formData.smoking}
                  onChange={(e) => setFormData({ ...formData, smoking: e.target.value as any })}
                >
                  <option value="none">비흡연</option>
                  <option value="past">과거 흡연</option>
                  <option value="current">현재 흡연</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>음주</label>
                <select
                  className={styles.select}
                  value={formData.alcohol}
                  onChange={(e) => setFormData({ ...formData, alcohol: e.target.value as any })}
                >
                  <option value="none">금주</option>
                  <option value="occasional">가끔</option>
                  <option value="regular">정기적</option>
                  <option value="heavy">과음</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 추가 사항 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>추가 사항 (Additional Notes)</h3>
          </div>
          <div className={styles.sectionContent}>
            <div className={styles.formGroup}>
              <label className={styles.label}>추가 메모</label>
              <textarea
                className={styles.textarea}
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                placeholder="예: 최근 업무 스트레스가 많음. 식사 불규칙."
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className={styles.submitSection}>
          <button type="button" className={styles.cancelBtn}>
            취소
          </button>
          <button type="submit" className={styles.submitBtn}>
            문진표 제출
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuestionnaireFormPage;
