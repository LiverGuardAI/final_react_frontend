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
  workflowState?: string;
  queuedAt?: string;
  phone?: string;
  questionnaireStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  questionnaireData?: any;
}

import type { DoctorDashboardStats } from '../../api/doctorApi';

interface DoctorSidebarProps {
  doctorName: string;
  departmentName: string;
  sidebarTab: 'waiting' | 'completed';
  setSidebarTab: (tab: 'waiting' | 'completed') => void;
  stats: DoctorDashboardStats;
  waitingPatients: Patient[];
  inProgressPatients: Patient[];
  completedPatients: Patient[];
  onPatientCardClick: (patient: Patient) => void;
  onStartConsultation: (patient: Patient, event: React.MouseEvent) => Promise<void>;
  onResumeConsultation: (patient: Patient, event: React.MouseEvent) => void;
}

const DoctorSidebar = memo(function DoctorSidebar({
  doctorName,
  departmentName,
  sidebarTab,
  setSidebarTab,
  stats,
  waitingPatients,
  inProgressPatients,
  completedPatients,
  onPatientCardClick,
  onStartConsultation,
  onResumeConsultation,
}: DoctorSidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        {/* 프로필 섹션 */}
        <div className={styles.profileSection}>
          <div className={styles.profileImage}>
            <svg className={styles.profileIcon} viewBox="0 0 64 64" aria-hidden="true">
              <rect x="10" y="14" width="44" height="40" rx="8" fill="#7AA6D6" />
              <rect x="16" y="20" width="8" height="8" rx="2" fill="#E6F0FA" />
              <rect x="40" y="20" width="8" height="8" rx="2" fill="#E6F0FA" />
              <rect x="16" y="34" width="8" height="8" rx="2" fill="#E6F0FA" />
              <rect x="40" y="34" width="8" height="8" rx="2" fill="#E6F0FA" />
              <rect x="29" y="24" width="6" height="16" rx="2" fill="#FFFFFF" />
              <rect x="24" y="29" width="16" height="6" rx="2" fill="#FFFFFF" />
            </svg>
          </div>
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
              진료대기 ({waitingPatients.length + inProgressPatients.length}명)
            </button>
            <button
              className={`${styles.patientListTab} ${sidebarTab === 'completed' ? styles.active : ''}`}
              onClick={() => setSidebarTab('completed')}
            >
              진료완료 ({completedPatients.length}명)
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
                      {/* 문진표 상태 뱃지 */}
                      <span style={{
                        background: patient.questionnaireStatus === 'COMPLETED' ? '#D7E8FB' :
                          patient.questionnaireStatus === 'IN_PROGRESS' ? '#9ECFF5' : '#E3F2FD',
                        color: patient.questionnaireStatus === 'IN_PROGRESS' ? '#045A8C' : '#52759C',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginRight: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        {patient.questionnaireStatus === 'COMPLETED' ? '작성완료' :
                          patient.questionnaireStatus === 'IN_PROGRESS' ? '작성중' : '미작성'}
                      </span>
                      <span
                        onClick={(e) => onResumeConsultation(patient, e)}
                        style={{
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
                      {patient.queuedAt ? new Date(patient.queuedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </div>
                  </div>
                ))}

                {/* 대기중인 환자 */}
                {waitingPatients.map((patient, index) => (
                  <div
                    key={patient.encounterId}
                    className={styles.patientCard}
                    onClick={() => onPatientCardClick(patient)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.patientHeader}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '8px', color: '#52759C', fontWeight: 'bold' }}>{index + 1}</span>
                        <span className={styles.patientName}>{patient.name}</span>
                      </div>
                      <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                    </div>
                    <div className={styles.patientDetails}>
                      {patient.birthDate} | {patient.age}세 | {patient.gender}
                    </div>
                    <div className={styles.patientActions}>
                      {/* 문진표 상태 뱃지 */}
                      <span style={{
                        background: patient.questionnaireStatus === 'COMPLETED' ? '#D7E8FB' :
                          patient.questionnaireStatus === 'IN_PROGRESS' ? '#9ECFF5' : '#E3F2FD',
                        color: patient.questionnaireStatus === 'IN_PROGRESS' ? '#045A8C' : '#52759C',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginRight: '8px',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {patient.questionnaireStatus === 'COMPLETED' ? '작성완료' :
                          patient.questionnaireStatus === 'IN_PROGRESS' ? '작성중' : '미작성'}
                      </span>
                      <button
                        className={`${styles.actionButton} ${patient.workflowState === 'WAITING_ADDITIONAL_CLINIC' ? styles.additional : styles.start}`}
                        onClick={(e) => onStartConsultation(patient, e)}
                        disabled={inProgressPatients.length > 0}
                        style={inProgressPatients.length > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        title={inProgressPatients.length > 0 ? '현재 진료 중인 환자가 있습니다' : ''}
                      >
                        {patient.workflowState === 'WAITING_ADDITIONAL_CLINIC' ? '추가진료' : '진료시작'}
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                      {patient.queuedAt ? new Date(patient.queuedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </div>
                  </div>
                ))}

                {inProgressPatients.length === 0 && waitingPatients.length === 0 && (
                  <div className={styles.emptyState}>대기 중인 환자가 없습니다</div>
                )}
              </>
            ) : completedPatients.length > 0 ? (
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
                완료된 진료가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default DoctorSidebar;
