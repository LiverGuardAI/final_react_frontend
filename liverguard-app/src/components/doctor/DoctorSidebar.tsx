import { memo } from 'react';
import styles from '../../layouts/DoctorLayout.module.css';

interface Patient {
  encounterId: number;
  patientId: string;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  queuedAt?: string;
  phone?: string;
  questionnaireStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  questionnaireData?: any;
}

interface DoctorSidebarProps {
  doctorName: string;
  departmentName: string;
  sidebarTab: 'waiting' | 'completed';
  setSidebarTab: (tab: 'waiting' | 'completed') => void;
  patientStatus: {
    waiting: number;
    inProgress: number;
    completed: number;
  };
  waitingPatients: Patient[];
  inProgressPatients: Patient[];
  completedPatients: Patient[];
  onPatientCardClick: (patient: Patient) => void;
  onStartConsultation: (patient: Patient, event: React.MouseEvent) => Promise<void>;
}

const DoctorSidebar = memo(function DoctorSidebar({
  doctorName,
  departmentName,
  sidebarTab,
  setSidebarTab,
  patientStatus,
  waitingPatients,
  inProgressPatients,
  completedPatients,
  onPatientCardClick,
  onStartConsultation,
}: DoctorSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        {/* 프로필 섹션 */}
        <div className={styles.profileSection}>
          <div className={styles.profileImage}></div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{doctorName}</div>
            <div className={styles.departmentTag}>{departmentName}</div>
            <div className={styles.statusInfo}>
              상태: <span className={styles.statusBadge}>근무중</span>
            </div>
          </div>
        </div>

        {/* 환자 리스트 섹션 */}
        <div className={styles.patientListSection}>
          <div className={styles.patientListTabs}>
            <button
              className={`${styles.patientListTab} ${sidebarTab === 'waiting' ? styles.active : ''}`}
              onClick={() => setSidebarTab('waiting')}
            >
              진료대기 ({patientStatus.waiting}명)
            </button>
            <button
              className={`${styles.patientListTab} ${sidebarTab === 'completed' ? styles.active : ''}`}
              onClick={() => setSidebarTab('completed')}
            >
              진료완료 ({patientStatus.completed}명)
            </button>
          </div>

          <div className={styles.patientListContent}>
            {sidebarTab === 'waiting' ? (
              <>
                {/* 진료중인 환자 (상단 우선 표시) */}
                {inProgressPatients.map((patient) => (
                  <div
                    key={patient.encounterId}
                    className={`${styles.patientCard} ${styles.inProgress}`}
                    onClick={() => onPatientCardClick(patient)}
                    style={{ cursor: 'pointer', borderLeft: '4px solid #6C5CE7' }}
                  >
                    <div className={styles.patientHeader}>
                      <span className={styles.patientName}>{patient.name}</span>
                      <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                    </div>
                    <div className={styles.patientDetails}>
                      {patient.birthDate} | {patient.age}세 | {patient.gender}
                    </div>
                    <div className={styles.patientActions}>
                      <span style={{
                        background: '#6C5CE7',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        진료중
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                      {patient.queuedAt ? new Date(patient.queuedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : 'N/A'}
                    </div>
                  </div>
                ))}

                {/* 대기중인 환자 */}
                {waitingPatients.map((patient) => (
                  <div
                    key={patient.encounterId}
                    className={styles.patientCard}
                    onClick={() => onPatientCardClick(patient)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.patientHeader}>
                      <span className={styles.patientName}>{patient.name}</span>
                      <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                    </div>
                    <div className={styles.patientDetails}>
                      {patient.birthDate} | {patient.age}세 | {patient.gender}
                    </div>
                    <div className={styles.patientActions}>
                      <button
                        className={`${styles.actionButton} ${styles.start}`}
                        onClick={(e) => onStartConsultation(patient, e)}
                      >
                        진료시작
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                      {patient.queuedAt ? new Date(patient.queuedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : 'N/A'}
                    </div>
                  </div>
                ))}

                {inProgressPatients.length === 0 && waitingPatients.length === 0 && (
                  <div className={styles.emptyState}>대기 중인 환자가 없습니다</div>
                )}
              </>
            ) : sidebarTab === 'completed' && completedPatients.length > 0 ? (
              completedPatients.map((patient) => (
                <div
                  key={patient.encounterId}
                  className={styles.patientCard}
                  onClick={() => onPatientCardClick(patient)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.patientHeader}>
                    <span className={styles.patientName}>{patient.name}</span>
                    <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                  </div>
                  <div className={styles.patientDetails}>
                    {patient.birthDate} | {patient.age}세 | {patient.gender}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                {sidebarTab === 'waiting' ? '대기 중인 환자가 없습니다' : '완료된 진료가 없습니다'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default DoctorSidebar;
