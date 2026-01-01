// src/pages/doctor/StagePrediction.tsx
import DoctorLayout from '../../layouts/DoctorLayout';

export default function StagePredictionPage() {
  return (
    <DoctorLayout activeTab="testForm">
      <div style={{
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '18px',
        color: '#6b7280'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '20px', color: '#1a1a1a' }}>
          간암 병기예측
        </h2>
        <p>AI 기반 간암 병기예측 결과가 표시됩니다.</p>
      </div>
    </DoctorLayout>
  );
}
