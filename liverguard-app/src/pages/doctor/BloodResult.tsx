// src/pages/doctor/BloodResult.tsx
import DoctorLayout from '../../layouts/DoctorLayout';

export default function BloodResultPage() {
  return (
    <DoctorLayout activeTab="examination">
      <div style={{
        padding: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        혈액 검사 결과가 들어갑니다.
      </div>
    </DoctorLayout>
  );
}