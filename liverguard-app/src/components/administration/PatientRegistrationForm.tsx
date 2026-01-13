import React, { useState } from 'react';
import styles from "../../pages/administration/Dashboard.module.css";
import type { PatientRegistrationData } from '../../api/administrationApi';

interface PatientRegistrationFormProps {
  onSubmit: (data: PatientRegistrationData) => Promise<{ patient?: { patient_id?: string } }>;
  onCancel: () => void;
}

const PatientRegistrationForm: React.FC<PatientRegistrationFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    gender: '' as '' | 'M' | 'F',
    phone: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (!formData.name || !formData.date_of_birth || !formData.gender) {
        setFormError('필수 항목을 모두 입력해주세요.');
        setIsSubmitting(false);
        return;
      }

      const data: PatientRegistrationData = {
        name: formData.name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        phone: formData.phone.trim() || undefined,
      };

      await onSubmit(data);

      // 폼 초기화
      setFormData({
        name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
      });
    } catch (error: any) {
      console.error('환자 등록 실패:', error);

      if (error.response?.data) {
        const errorData = error.response.data;
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

  return (
    <form onSubmit={handleSubmit} className={styles.registrationForm}>
      <h3>신규 환자 등록</h3>

      {formError && <div className={styles.errorMessage}>{formError}</div>}

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>이름 <span className={styles.required}>*</span></label>
        <input
          type="text"
          className={styles.formInput}
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="홍길동"
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>생년월일 <span className={styles.required}>*</span></label>
        <input
          type="date"
          className={styles.formInput}
          value={formData.date_of_birth}
          onChange={(e) => handleChange('date_of_birth', e.target.value)}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>성별 <span className={styles.required}>*</span></label>
        <select
          className={styles.formInput}
          value={formData.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
          required
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
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="010-1234-5678"
        />
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? '등록 중...' : '등록'}
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isSubmitting}>
          취소
        </button>
      </div>
    </form>
  );
};

export default PatientRegistrationForm;
