// src/pages/radiology/AcquisitionPage.tsx
import React, { useState } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import PatientQueueSidebar from '../../components/radiology/PatientQueueSidebar';
import type { SelectedPatientData } from '../../components/radiology/PatientQueueSidebar';
import './AcquisitionPage.css';

const AcquisitionPage: React.FC = () => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientData, setSelectedPatientData] = useState<SelectedPatientData | null>(null);

  const handlePatientSelect = (patientId: string, patientData: SelectedPatientData) => {
    setSelectedPatientId(patientId);
    setSelectedPatientData(patientData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('Files selected:', files);
      // 파일 업로드 로직 구현
    }
  };

  return (
    <div className="acquisition-page">
      {selectedPatientData ? (
        <PatientHeader
          patientId={selectedPatientData.patientId}
          patientName={selectedPatientData.patientName}
          gender={selectedPatientData.gender}
          birthDate={selectedPatientData.birthDate}
          examType="CT Abdomen"
          examDate={new Date().toLocaleString('ko-KR')}
        />
      ) : (
        <div className="no-patient-selected">
          환자를 선택해주세요
        </div>
      )}

      <div className="acquisition-content">
        <PatientQueueSidebar
          selectedPatientId={selectedPatientId}
          onPatientSelect={handlePatientSelect}
        />

        <div className="main-content">
          <div className="upload-area">
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              accept=".dcm,.dicom"
            />
            <label htmlFor="file-upload" className="upload-button">
              업로드
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcquisitionPage;
