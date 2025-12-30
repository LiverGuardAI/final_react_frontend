// src/pages/doctor/DDI.tsx
import DoctorLayout from '../../layouts/DoctorLayout';

export default function DDIPage() {
  return (
    <DoctorLayout activeTab="medication">
      <div style={{
        padding: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        약물 상호작용 분석 내용이 들어갑니다.
      </div>
    </DoctorLayout>
  );
}