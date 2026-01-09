import React from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';
import type { LabResult, ImagingOrder } from '../../../api/doctorApi';

interface PatientInfoHeaderProps {
    patient: any; // Using any for now to match flexible usage, ideally should be typed
    labResults: LabResult[];
    imagingOrders: ImagingOrder[];
}

export default function PatientInfoHeader({ patient, labResults, imagingOrders }: PatientInfoHeaderProps) {
    if (!patient) {
        return (
            <div className={styles.patientHeader}>
                <div className={styles.patientInfo}>
                    <div className={styles.patientName}>
                        <h1 style={{ color: '#ccc' }}>환자 정보 없음</h1>
                    </div>
                    <div className={styles.patientInfoItem} style={{ color: '#ccc' }}>
                        환자를 선택해주세요
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.patientHeader}>
            <div className={styles.patientInfo}>
                <div className={styles.patientName}>
                    <h1>{patient.name}</h1>
                    <span>
                        ({patient.gender === 'M' ? '남' : '여'}
                        {patient.age ? `, ${patient.age}세` : ''})
                    </span>
                </div>
                <div className={styles.patientInfoItem}>{patient.patient_id}</div>
                <div className={styles.patientInfoItem}>
                    생년월일: {patient.date_of_birth || 'N/A'}
                </div>
                <div className={styles.patientInfoItem}>
                    연락처: {patient.phone || 'N/A'}
                </div>

                {labResults.length > 0 && (
                    <div className={styles.testBadges}>
                        <span className={`${styles.testBadge} ${styles.completed}`}>
                            혈액검사 완료 ({labResults[0].test_date})
                        </span>
                    </div>
                )}

                {imagingOrders.length > 0 && imagingOrders[0].status === 'COMPLETED' && (
                    <div className={styles.testBadges}>
                        <span className={`${styles.testBadge} ${styles.ct}`}>
                            {imagingOrders[0].modality} 완료 (
                            {new Date(imagingOrders[0].ordered_at).toLocaleDateString()})
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
