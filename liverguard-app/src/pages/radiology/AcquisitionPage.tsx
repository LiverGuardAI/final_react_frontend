// src/pages/radiology/AcquisitionPage.tsx
import React, { useState } from 'react';
import PatientHeader from '../../components/radiology/PatientHeader';
import PatientQueueSidebar from '../../components/radiology/PatientQueueSidebar';
import type { SelectedPatientData } from '../../components/radiology/PatientQueueSidebar';
import { endFilming } from '../../api/radiology_api';
import './AcquisitionPage.css';

const AcquisitionPage: React.FC = () => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientData, setSelectedPatientData] = useState<SelectedPatientData | null>(null);

  const handlePatientSelect = (patientId: string, patientData: SelectedPatientData) => {
    setSelectedPatientId(patientId);
    setSelectedPatientData(patientData);
  };

  const handleEndFilming = async () => {
    if (!selectedPatientId) {
      alert('촬영 중인 환자가 없습니다.');
      return;
    }

    try {
      await endFilming(selectedPatientId);
      alert('촬영이 종료되었습니다.');
      // 환자 선택 초기화
      setSelectedPatientId('');
      setSelectedPatientData(null);
      // 페이지 새로고침으로 대기 목록 갱신
      window.location.reload();
    } catch (error) {
      console.error('Failed to end filming:', error);
      alert('촬영 종료에 실패했습니다.');
    }
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
      <div className="header-container">
        {selectedPatientData ? (
          <>
            <PatientHeader
              patientId={selectedPatientData.patientId}
              patientName={selectedPatientData.patientName}
              gender={selectedPatientData.gender}
              birthDate={selectedPatientData.birthDate}
              examType="CT Abdomen"
              examDate={new Date().toLocaleString('ko-KR')}
            />
            <button className="end-filming-button" onClick={handleEndFilming}>
              촬영 종료
            </button>
          </>
        ) : (
          <div className="no-patient-selected">
            환자를 선택해주세요
          </div>
        )}
      </div>

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
