// src/components/radiology/PatientHeader.tsx
import React from 'react';
import './PatientHeader.css';

interface PatientHeaderProps {
  patientId: string;
  patientName: string;
  gender: string;
  age?: number | null;
  birthDate?: string;
  orderNotes?: string[];
  showPatientInfo?: boolean;
  examType: string;
  examDate: string;
  actionButton?: React.ReactNode;
  onBrandClick?: () => void;
}

const PatientHeader: React.FC<PatientHeaderProps> = ({
  patientId,
  patientName,
  gender,
  age,
  birthDate,
  orderNotes,
  showPatientInfo = true,
  examType,
  examDate,
  actionButton,
  onBrandClick,
}) => {
  const hasAge = typeof age === 'number' && !Number.isNaN(age);
  const ageOrBirthLabel = hasAge ? '나이:' : '생년월일:';
  const ageOrBirthValue = hasAge ? `${age}세` : (birthDate || 'N/A');
  const showOrderNotes = orderNotes !== undefined;
  const orderNotesValue =
    orderNotes && orderNotes.length > 0 ? orderNotes.join(' / ') : 'N/A';
  const brandClassName = `patient-header-brand${onBrandClick ? ' clickable' : ''}`;

  return (
    <div className="patient-header">
      {onBrandClick ? (
        <button
          type="button"
          className={brandClassName}
          aria-label="LiverGuard"
          onClick={onBrandClick}
        >
          LiverGuard
        </button>
      ) : (
        <div className={brandClassName} aria-label="LiverGuard">
          LiverGuard
        </div>
      )}
      <div className="patient-header-content">
        {showPatientInfo && (
          <>
            <div className="patient-info-item">
              <span className="label">환자명:</span>
              <span className="value">{patientName} ({patientId})</span>
            </div>
            <div className="patient-info-item">
              <span className="label">성별:</span>
              <span className="value">{gender}</span>
            </div>
            <div className="patient-info-item">
              <span className="label">{ageOrBirthLabel}</span>
              <span className="value">{ageOrBirthValue}</span>
            </div>
          </>
        )}
        <div className="patient-info-item">
          <span className="label">검사명:</span>
          <span className="value">{examType}</span>
        </div>
        <div className="patient-info-item">
          <span className="label">촬영일시:</span>
          <span className="value">{examDate}</span>
        </div>
        {showOrderNotes && (
          <div className="patient-info-item patient-info-notes">
            <span className="label">오더 노트:</span>
            <span className="value">{orderNotesValue}</span>
          </div>
        )}
      </div>
      {actionButton && actionButton}
    </div>
  );
};

export default PatientHeader;
