import React, { useState } from 'react';
import styles from '../../pages/administration/HomePage.module.css';

interface QuestionnaireModalProps {
  isOpen: boolean;
  patient: {
    id: string;
    name: string;
    birthDate: string;
    gender: string;
  } | null;
  initialData?: QuestionnaireData | null;
  onClose: () => void;
  onSubmit: (data: QuestionnaireData) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export interface QuestionnaireData {
  patient_id: string;
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

const QuestionnaireModal: React.FC<QuestionnaireModalProps> = ({
  isOpen,
  patient,
  initialData,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<QuestionnaireData>({
    patient_id: '',
    chief_complaint: '',
    symptom_duration: '',
    pain_level: 0,
    symptoms: {
      abdominal_pain: false,
      nausea: false,
      vomiting: false,
      diarrhea: false,
      constipation: false,
      bloating: false,
      appetite_loss: false,
      weight_loss: false,
      fatigue: false,
      jaundice: false,
      fever: false,
      other: '',
    },
    medical_history: {
      hepatitis: false,
      cirrhosis: false,
      diabetes: false,
      hypertension: false,
      cancer: false,
      other: '',
    },
    family_history: '',
    medications: '',
    allergies: '',
    smoking: 'none',
    alcohol: 'none',
    additional_notes: '',
  });

  React.useEffect(() => {
    if (patient && isOpen) {
      if (initialData) {
        // 기존 데이터가 있으면 불러오기
        setFormData({ ...initialData, patient_id: patient.id });
      } else {
        // 새로 작성
        setFormData(prev => ({ ...prev, patient_id: patient.id }));
      }
    }
  }, [patient, isOpen, initialData]);

  const handleSubmit = async () => {
    if (!patient) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('문진표 제출 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmed = window.confirm('문진표를 삭제하시겠습니까?\n삭제된 문진표는 복구할 수 없습니다.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('문진표 삭제 실패:', error);
      alert('문진표 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !patient) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className={styles.modalHeader}>
          <h2>문진표 작성 - {patient.name}</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody} style={{ padding: '25px' }}>
          {/* 주 호소 */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>
              주 호소 (Chief Complaint)
            </h3>
            <div className={styles.formGroup}>
              <label htmlFor="chief_complaint" className={styles.formLabel}>주 증상 <span className={styles.required}>*</span></label>
              <textarea
                id="chief_complaint"
                name="chief_complaint"
                className={styles.formInput}
                placeholder="환자가 호소하는 주요 증상을 입력하세요"
                value={formData.chief_complaint}
                onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                rows={3}
                style={{ resize: 'vertical' }}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className={styles.formGroup}>
                <label htmlFor="symptom_duration" className={styles.formLabel}>증상 지속 기간</label>
                <input
                  id="symptom_duration"
                  name="symptom_duration"
                  type="text"
                  className={styles.formInput}
                  placeholder="예: 2주, 3일"
                  value={formData.symptom_duration}
                  onChange={(e) => setFormData({ ...formData, symptom_duration: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pain_level" className={styles.formLabel}>통증 정도 (0-10)</label>
                <input
                  id="pain_level"
                  name="pain_level"
                  type="number"
                  className={styles.formInput}
                  min="0"
                  max="10"
                  value={formData.pain_level}
                  onChange={(e) => setFormData({ ...formData, pain_level: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* 현재 증상 */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>
              현재 증상 (Current Symptoms)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {Object.entries({
                abdominal_pain: '복통',
                nausea: '오심',
                vomiting: '구토',
                diarrhea: '설사',
                constipation: '변비',
                bloating: '복부팽만감',
                appetite_loss: '식욕부진',
                weight_loss: '체중감소',
                fatigue: '피로감',
                jaundice: '황달',
                fever: '발열',
              }).map(([key, label]) => (
                <label key={key} htmlFor={`symptom_${key}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    id={`symptom_${key}`}
                    name={`symptom_${key}`}
                    type="checkbox"
                    checked={formData.symptoms[key as keyof typeof formData.symptoms] as boolean}
                    onChange={(e) => setFormData({
                      ...formData,
                      symptoms: { ...formData.symptoms, [key]: e.target.checked }
                    })}
                  />
                  <span style={{ fontSize: '14px' }}>{label}</span>
                </label>
              ))}
            </div>
            <div className={styles.formGroup} style={{ marginTop: '10px' }}>
              <label htmlFor="symptoms_other" className={styles.formLabel}>기타 증상</label>
              <input
                id="symptoms_other"
                name="symptoms_other"
                type="text"
                className={styles.formInput}
                placeholder="위에 없는 증상을 입력하세요"
                value={formData.symptoms.other}
                onChange={(e) => setFormData({
                  ...formData,
                  symptoms: { ...formData.symptoms, other: e.target.value }
                })}
              />
            </div>
          </div>

          {/* 과거 병력 */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>
              과거 병력 (Medical History)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {Object.entries({
                hepatitis: '간염',
                cirrhosis: '간경화',
                diabetes: '당뇨',
                hypertension: '고혈압',
                cancer: '암',
              }).map(([key, label]) => (
                <label key={key} htmlFor={`medical_${key}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    id={`medical_${key}`}
                    name={`medical_${key}`}
                    type="checkbox"
                    checked={formData.medical_history[key as keyof typeof formData.medical_history] as boolean}
                    onChange={(e) => setFormData({
                      ...formData,
                      medical_history: { ...formData.medical_history, [key]: e.target.checked }
                    })}
                  />
                  <span style={{ fontSize: '14px' }}>{label}</span>
                </label>
              ))}
            </div>
            <div className={styles.formGroup} style={{ marginTop: '10px' }}>
              <label htmlFor="medical_other" className={styles.formLabel}>기타 병력</label>
              <input
                id="medical_other"
                name="medical_other"
                type="text"
                className={styles.formInput}
                placeholder="위에 없는 병력을 입력하세요"
                value={formData.medical_history.other}
                onChange={(e) => setFormData({
                  ...formData,
                  medical_history: { ...formData.medical_history, other: e.target.value }
                })}
              />
            </div>
          </div>

          {/* 추가 정보 */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', color: '#333' }}>
              추가 정보
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              <div className={styles.formGroup}>
                <label htmlFor="family_history" className={styles.formLabel}>가족력</label>
                <input
                  id="family_history"
                  name="family_history"
                  type="text"
                  className={styles.formInput}
                  placeholder="가족의 질병력을 입력하세요"
                  value={formData.family_history}
                  onChange={(e) => setFormData({ ...formData, family_history: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="medications" className={styles.formLabel}>현재 복용 중인 약물</label>
                <input
                  id="medications"
                  name="medications"
                  type="text"
                  className={styles.formInput}
                  placeholder="복용 중인 약물을 입력하세요"
                  value={formData.medications}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="allergies" className={styles.formLabel}>알레르기</label>
                <input
                  id="allergies"
                  name="allergies"
                  type="text"
                  className={styles.formInput}
                  placeholder="알레르기가 있다면 입력하세요"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className={styles.formGroup}>
                  <label htmlFor="smoking" className={styles.formLabel}>흡연</label>
                  <select
                    id="smoking"
                    name="smoking"
                    className={styles.formInput}
                    value={formData.smoking}
                    onChange={(e) => setFormData({ ...formData, smoking: e.target.value as any })}
                  >
                    <option value="none">비흡연</option>
                    <option value="past">과거 흡연</option>
                    <option value="current">현재 흡연</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="alcohol" className={styles.formLabel}>음주</label>
                  <select
                    id="alcohol"
                    name="alcohol"
                    className={styles.formInput}
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
              <div className={styles.formGroup}>
                <label htmlFor="additional_notes" className={styles.formLabel}>추가 사항</label>
                <textarea
                  id="additional_notes"
                  name="additional_notes"
                  className={styles.formInput}
                  placeholder="추가로 전달할 사항이 있다면 입력하세요"
                  value={formData.additional_notes}
                  onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting || !formData.chief_complaint}
              style={{ opacity: (isSubmitting || isDeleting || !formData.chief_complaint) ? 0.5 : 1 }}
            >
              {isSubmitting ? '제출 중...' : initialData ? '수정' : '제출'}
            </button>
            {initialData && onDelete && (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
                style={{
                  opacity: (isSubmitting || isDeleting) ? 0.5 : 1,
                  background: '#FFCDD2',
                  color: '#C62828'
                }}
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            )}
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
            >
              {initialData ? '닫기' : '나중에 작성'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireModal;
