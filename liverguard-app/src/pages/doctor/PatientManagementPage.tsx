// src/pages/doctor/PatientManagementPage.tsx
import DoctorLayout from '../../layouts/DoctorLayout';

export default function PatientManagementPage() {
  return (
    <DoctorLayout activeTab="patientManagement">
      <div style={{
        padding: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        환자관리 페이지 입니다.
      </div>
    </DoctorLayout>
  );
}