import React from 'react';
import styles from './PatientActionModal.module.css';

interface PatientActionModalProps {
  isOpen: boolean;
  patient: {
    id: string;
    name: string;
    patientId?: string;
    birthDate?: string;
    gender?: string;
    phone?: string;
    registrationTime?: string;
    encounterId?: number;
    questionnaireStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    encounter_status?: 'WAITING' | 'WAITING_RESULTS' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    encounter_start?: string;
    resultWaitingLabel?: string;
    resultWaitingStartedAt?: string;
    waitingDurationSeconds?: number;
  } | null;
  onClose: () => void;
  onQuestionnaireAction: () => void;
  onViewDetails?: () => void;
}

const PatientActionModal: React.FC<PatientActionModalProps> = ({
  isOpen,
  patient,
  onClose,
  onQuestionnaireAction,
  onViewDetails,
}) => {
  if (!isOpen || !patient) return null;

  const calculateWaitingTime = (
    registrationTime?: string,
    encounterStart?: string,
    encounterStatus?: string,
    resultWaitingStartedAt?: string,
    waitingDurationSeconds?: number
  ) => {
    if (encounterStatus === 'WAITING_RESULTS' && typeof waitingDurationSeconds === 'number') {
      const totalMinutes = Math.floor(waitingDurationSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        return `${hours}시간 ${minutes}분`;
      }
      return `${minutes}분`;
    }

    const baseTime = encounterStatus === 'WAITING_RESULTS' && resultWaitingStartedAt
      ? resultWaitingStartedAt
      : encounterStatus === 'IN_PROGRESS' && encounterStart
        ? encounterStart
        : registrationTime;

    if (!baseTime) return 'N/A';

    const startTime = new Date(baseTime);
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  const getQuestionnaireButtonText = () => {
    if (!patient.questionnaireStatus || patient.questionnaireStatus === 'NOT_STARTED') {
      return '문진표 작성';
    }
    if (patient.questionnaireStatus === 'COMPLETED') {
      return '문진표 수정/삭제';
    }
    return '문진표 계속 작성';
  };

  const waitingTime = calculateWaitingTime(
    patient.registrationTime,
    patient.encounter_start,
    patient.encounter_status,
    patient.resultWaitingStartedAt,
    patient.waitingDurationSeconds
  );

  const isInProgress = patient.encounter_status === 'IN_PROGRESS';
  const isWaitingResults = patient.encounter_status === 'WAITING_RESULTS';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>환자 작업 선택</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.patientSummary}>
            <div className={styles.summaryRow}>
              <span className={styles.patientName}>{patient.name}</span>
              <span className={styles.patientGender}>
                {patient.gender || 'N/A'}
              </span>
            </div>
            <div className={styles.summaryDetails}>
              <span className={styles.detailItem}>
                환자ID: {patient.patientId || patient.id}
              </span>
              {patient.birthDate && (
                <span className={styles.detailItem}>
                  생년월일: {patient.birthDate}
                </span>
              )}
              {patient.resultWaitingLabel && (
                <span className={styles.detailItem}>
                  결과 대기: {patient.resultWaitingLabel}
                </span>
              )}
            </div>
          </div>

          {patient.registrationTime && (
            <div className={styles.waitingTimeBox}>
              <div className={styles.waitingLabel}>
                {isWaitingResults ? '결과 대기 시간' : isInProgress ? '진료 시간' : '대기 시간'}
              </div>
              <div className={styles.waitingTime}>{waitingTime}</div>
              <div className={styles.waitingDetail}>
                {isWaitingResults && patient.resultWaitingStartedAt
                  ? `결과 대기 시작: ${new Date(patient.resultWaitingStartedAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                  : isInProgress && patient.encounter_start
                    ? `진료 시작: ${new Date(patient.encounter_start).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`
                    : `접수시간: ${new Date(patient.registrationTime).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}`
                }
              </div>
            </div>
          )}

          <div className={styles.actionButtons}>
            <button
              className={`${styles.actionButton} ${styles.questionnaireBtn}`}
              onClick={() => {
                onQuestionnaireAction();
                onClose();
              }}
            >
              <div className={styles.buttonIcon}>문진</div>
              <div className={styles.buttonText}>
                <div className={styles.buttonTitle}>{getQuestionnaireButtonText()}</div>
                <div className={styles.buttonDesc}>
                  {patient.questionnaireStatus === 'COMPLETED'
                    ? '작성된 문진표 확인 및 수정'
                    : '문진표 작성하기'}
                </div>
              </div>
            </button>

            {onViewDetails && (
              <button
                className={`${styles.actionButton} ${styles.detailsBtn}`}
                onClick={() => {
                  onViewDetails();
                  onClose();
                }}
              >
                <div className={styles.buttonIcon}>상세</div>
                <div className={styles.buttonText}>
                  <div className={styles.buttonTitle}>환자 상세정보</div>
                  <div className={styles.buttonDesc}>기본 정보 및 진료 기록 확인</div>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientActionModal;
