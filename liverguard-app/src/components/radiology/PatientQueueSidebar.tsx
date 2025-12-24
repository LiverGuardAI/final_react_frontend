// src/components/radiology/PatientQueueSidebar.tsx
import React from 'react';
import './PatientQueueSidebar.css';

interface Patient {
  id: string;
  name: string;
  episode: string;
  status: '탭영중' | '촬영대기';
}

interface PatientQueueSidebarProps {
  patients: Patient[];
  selectedPatientId?: string;
  onPatientSelect: (patientId: string) => void;
}

const PatientQueueSidebar: React.FC<PatientQueueSidebarProps> = ({
  patients,
  selectedPatientId,
  onPatientSelect,
}) => {
  return (
    <div className="patient-queue-sidebar">
      <div className="sidebar-header">
        <h2>환자 대기열</h2>
      </div>

      <div className="patient-list">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className={`patient-card ${selectedPatientId === patient.id ? 'selected' : ''}`}
            onClick={() => onPatientSelect(patient.id)}
          >
            <div className="patient-card-header">
              <span className="patient-name">{patient.name}</span>
              <span className={`status-badge ${patient.status === '탭영중' ? 'active' : 'waiting'}`}>
                {patient.status}
              </span>
            </div>
            <div className="patient-card-body">
              <div className="patient-episode">
                EPISODE<br />
                {patient.episode}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <h3>환자 정보</h3>
      </div>
    </div>
  );
};

export default PatientQueueSidebar;
