import React, { useState, useEffect } from 'react';
import styles from '../../pages/administration/HomePage.module.css';
import type { Doctor } from '../../hooks/useDoctors';

interface Patient {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
}

interface CheckinModalProps {
  isOpen: boolean;
  patient: Patient | null;
  doctors: Doctor[];
  onClose: () => void;
  onSubmit: (patientId: string, doctorId: number) => Promise<void>;
}

const CheckinModal: React.FC<CheckinModalProps> = ({
  isOpen,
  patient,
  doctors,
  onClose,
  onSubmit,
}) => {
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedDoctor(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!patient || !selectedDoctor) {
      alert('의사를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(patient.id, selectedDoctor);
      onClose();
    } catch (error) {
      console.error('접수 처리 중 오류:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !patient) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>현장 접수 - 의사 배정</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>환자 정보</h3>
            <p style={{ margin: '5px 0' }}><strong>이름:</strong> {patient.name}</p>
            <p style={{ margin: '5px 0' }}><strong>생년월일:</strong> {patient.birthDate}</p>
            <p style={{ margin: '5px 0' }}><strong>성별:</strong> {patient.gender}</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>담당 의사 선택 <span className={styles.required}>*</span></label>
            <select
              className={styles.formInput}
              value={selectedDoctor || ''}
              onChange={(e) => setSelectedDoctor(Number(e.target.value))}
              required
              style={{ fontSize: '15px' }}
            >
              <option value="">의사를 선택하세요</option>
              {doctors.map((doctor) => (
                <option key={doctor.doctor_id} value={doctor.doctor_id}>
                  [{doctor.department.dept_name}] {doctor.name}
                  {doctor.room_number ? ` (${doctor.room_number}호)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedDoctor}
              style={{ opacity: (!selectedDoctor || isSubmitting) ? 0.5 : 1 }}
            >
              {isSubmitting ? '접수 중...' : '접수 완료'}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckinModal;
