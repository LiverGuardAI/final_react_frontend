import React, { useState, useEffect } from 'react';
import styles from '../../pages/administration/HomePage.module.css';

interface Patient {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  phone: string;
}

interface PatientDetailModalProps {
  isOpen: boolean;
  patient: Patient | null;
  isEditing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave: (data: any) => Promise<void>;
  onCancelEdit: () => void;
}

const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen,
  patient,
  isEditing,
  onClose,
  onEdit,
  onSave,
  onCancelEdit,
}) => {
  const [editForm, setEditForm] = useState({
    name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    phone: '',
  });

  useEffect(() => {
    if (patient && isOpen) {
      setEditForm({
        name: patient.name || '',
        date_of_birth: patient.birthDate || '',
        gender: patient.gender === '남' ? 'M' : patient.gender === '여' ? 'F' : (patient.gender as '' | 'M' | 'F'),
        phone: patient.phone || '',
      });
    }
  }, [patient, isOpen]);

  const handleSave = async () => {
    await onSave(editForm);
  };

  if (!isOpen || !patient) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>환자 상세 정보</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {!isEditing ? (
            <div className={styles.patientDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>환자 ID:</span>
                <span className={styles.detailValue}>{patient.id}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>이름:</span>
                <span className={styles.detailValue}>{patient.name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>생년월일:</span>
                <span className={styles.detailValue}>{patient.birthDate}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>성별:</span>
                <span className={styles.detailValue}>{patient.gender}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>연락처:</span>
                <span className={styles.detailValue}>{patient.phone}</span>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.editButton} onClick={onEdit}>
                  수정
                </button>
                <button className={styles.cancelButton} onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.editForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>생년월일</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={editForm.date_of_birth}
                  onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>성별</label>
                <select
                  className={styles.formInput}
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as 'M' | 'F' })}
                >
                  <option value="">선택하세요</option>
                  <option value="M">남성</option>
                  <option value="F">여성</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>연락처</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>

              <div className={styles.modalActions}>
                <button className={styles.submitButton} onClick={handleSave}>
                  저장
                </button>
                <button className={styles.cancelButton} onClick={onCancelEdit}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDetailModal;
