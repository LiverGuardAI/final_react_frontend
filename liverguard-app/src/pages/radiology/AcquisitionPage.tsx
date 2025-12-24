// src/pages/radiology/AcquisitionPage.tsx
import React, { useState } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import PatientQueueSidebar from '../../components/radiology/PatientQueueSidebar';
import './AcquisitionPage.css';

const AcquisitionPage: React.FC = () => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('Files selected:', files);
      // 파일 업로드 로직 구현
    }
  };

  return (
    <div className="acquisition-page">
      <PatientHeader
        patientId="TCGA-BC-4073"
        patientName="홍길동"
        gender="M"
        birthDate="1998-10-08"
        examType="CT Abdomen"
        examDate="2025-12-11 11:17 AM"
      />

      <div className="acquisition-content">
        <PatientQueueSidebar
          selectedPatientId={selectedPatientId}
          onPatientSelect={setSelectedPatientId}
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
