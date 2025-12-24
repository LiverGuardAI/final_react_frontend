// src/components/radiology/PatientHeader.tsx
import React from 'react';
import './PatientHeader.css';

interface PatientHeaderProps {
  patientId: string;
  patientName: string;
  gender: string;
  birthDate: string;
  examType: string;
  examDate: string;
}

const PatientHeader: React.FC<PatientHeaderProps> = ({
  patientId,
  patientName,
  gender,
  birthDate,
  examType,
  examDate,
}) => {
  return (
    <div className="patient-header">
      <div className="patient-header-content">
        <div className="patient-info-item">
          <span className="label">환자명:</span>
          <span className="value">{patientName} ({patientId})</span>
        </div>
        <div className="patient-info-item">
          <span className="label">성별:</span>
          <span className="value">{gender}</span>
        </div>
        <div className="patient-info-item">
          <span className="label">생년월일:</span>
          <span className="value">{birthDate}</span>
        </div>
        <div className="patient-info-item">
          <span className="label">검사명:</span>
          <span className="value">{examType}</span>
        </div>
        <div className="patient-info-item">
          <span className="label">촬영일시:</span>
          <span className="value">{examDate}</span>
        </div>
      </div>
    </div>
  );
};

export default PatientHeader;
