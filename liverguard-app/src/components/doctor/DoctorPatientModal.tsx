import React from 'react';
import styles from './DoctorPatientModal.module.css';

interface Patient {
  encounterId: number;
  patientId: string;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  phone?: string;
  questionnaireStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface QuestionnaireData {
  chief_complaint: string;
  symptom_duration: string;
  pain_level: number;
  symptoms: {
    abdominal_pain: boolean;
    nausea: boolean;
    vomiting: boolean;
    diarrhea: boolean;
    constipation: boolean;
    bloating: boolean;
    appetite_loss: boolean;
    weight_loss: boolean;
    fatigue: boolean;
    jaundice: boolean;
    fever: boolean;
    other: string;
  };
  medical_history: {
    hepatitis: boolean;
    cirrhosis: boolean;
    diabetes: boolean;
    hypertension: boolean;
    cancer: boolean;
    other: string;
  };
  family_history: string;
  medications: string;
  allergies: string;
  smoking: 'none' | 'past' | 'current';
  alcohol: 'none' | 'occasional' | 'regular' | 'heavy';
  additional_notes: string;
}

interface DoctorPatientModalProps {
  isOpen: boolean;
  patient: Patient | null;
  questionnaireData?: QuestionnaireData | null;
  onClose: () => void;
}

const DoctorPatientModal: React.FC<DoctorPatientModalProps> = ({
  isOpen,
  patient,
  questionnaireData,
  onClose,
}) => {
  if (!isOpen || !patient) return null;

  // 흡연 상태 한글 변환
  const getSmokingText = (smoking: string) => {
    switch (smoking) {
      case 'none': return '비흡연';
      case 'past': return '과거 흡연';
      case 'current': return '현재 흡연';
      default: return '없음';
    }
  };

  // 음주 상태 한글 변환
  const getAlcoholText = (alcohol: string) => {
    switch (alcohol) {
      case 'none': return '없음';
      case 'occasional': return '가끔';
      case 'regular': return '정기적';
      case 'heavy': return '과음';
      default: return '없음';
    }
  };

  // 체크된 증상 목록 추출
  const getCheckedSymptoms = () => {
    if (!questionnaireData) return [];
    const symptoms = questionnaireData.symptoms;
    const symptomLabels: { [key: string]: string } = {
      abdominal_pain: '복통',
      nausea: '오심',
      vomiting: '구토',
      diarrhea: '설사',
      constipation: '변비',
      bloating: '복부 팽만',
      appetite_loss: '식욕 부진',
      weight_loss: '체중 감소',
      fatigue: '피로',
      jaundice: '황달',
      fever: '발열',
    };

    const checked = Object.entries(symptoms)
      .filter(([key, value]) => key !== 'other' && value === true)
      .map(([key]) => symptomLabels[key]);

    if (symptoms.other) {
      checked.push(symptoms.other);
    }

    return checked;
  };

  // 체크된 과거 병력 추출
  const getCheckedMedicalHistory = () => {
    if (!questionnaireData) return [];
    const history = questionnaireData.medical_history;
    const historyLabels: { [key: string]: string } = {
      hepatitis: '간염',
      cirrhosis: '간경화',
      diabetes: '당뇨',
      hypertension: '고혈압',
      cancer: '암',
    };

    const checked = Object.entries(history)
      .filter(([key, value]) => key !== 'other' && value === true)
      .map(([key]) => historyLabels[key]);

    if (history.other) {
      checked.push(history.other);
    }

    return checked;
  };

  const hasQuestionnaire = patient.questionnaireStatus === 'COMPLETED' && questionnaireData;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>환자 정보</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* 환자 기본 정보 */}
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>기본 정보</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>환자 ID:</span>
                <span className={styles.infoValue}>{patient.patientId}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>이름:</span>
                <span className={styles.infoValue}>{patient.name}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>생년월일:</span>
                <span className={styles.infoValue}>{patient.birthDate}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>나이:</span>
                <span className={styles.infoValue}>{patient.age}세</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>성별:</span>
                <span className={styles.infoValue}>{patient.gender}</span>
              </div>
            </div>
          </section>

          {/* 문진표 정보 */}
          {hasQuestionnaire ? (
            <>
              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>주 증상</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>주 호소 증상:</span>
                    <span className={styles.infoValue}>{questionnaireData.chief_complaint || '-'}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>증상 지속 기간:</span>
                    <span className={styles.infoValue}>{questionnaireData.symptom_duration || '-'}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>통증 정도:</span>
                    <span className={styles.infoValue}>{questionnaireData.pain_level}/10</span>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>증상 목록</h4>
                <div className={styles.tagList}>
                  {getCheckedSymptoms().length > 0 ? (
                    getCheckedSymptoms().map((symptom, index) => (
                      <span key={index} className={styles.tag}>{symptom}</span>
                    ))
                  ) : (
                    <span className={styles.noData}>없음</span>
                  )}
                </div>
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>과거 병력</h4>
                <div className={styles.tagList}>
                  {getCheckedMedicalHistory().length > 0 ? (
                    getCheckedMedicalHistory().map((history, index) => (
                      <span key={index} className={styles.tag}>{history}</span>
                    ))
                  ) : (
                    <span className={styles.noData}>없음</span>
                  )}
                </div>
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>가족력</h4>
                <p className={styles.textContent}>
                  {questionnaireData.family_history || '없음'}
                </p>
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>복용 중인 약물</h4>
                <p className={styles.textContent}>
                  {questionnaireData.medications || '없음'}
                </p>
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>알레르기</h4>
                <p className={styles.textContent}>
                  {questionnaireData.allergies || '없음'}
                </p>
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}>생활 습관</h4>
                <div className={styles.infoGrid}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>흡연:</span>
                    <span className={styles.infoValue}>{getSmokingText(questionnaireData.smoking)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>음주:</span>
                    <span className={styles.infoValue}>{getAlcoholText(questionnaireData.alcohol)}</span>
                  </div>
                </div>
              </section>

              {questionnaireData.additional_notes && (
                <section className={styles.section}>
                  <h4 className={styles.sectionTitle}>추가 사항</h4>
                  <p className={styles.textContent}>
                    {questionnaireData.additional_notes}
                  </p>
                </section>
              )}
            </>
          ) : (
            <section className={styles.section}>
              <div className={styles.noQuestionnaireMessage}>
                <p>작성된 문진표가 없습니다.</p>
              </div>
            </section>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.closeBtn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorPatientModal;
