import React from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';
import type { LabResult, ImagingOrder } from '../../../api/doctorApi';

const normalizeDisplayValue = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toUpperCase() === 'N/A') return null;
    return trimmed;
};

const formatDisplayValue = (value?: string | null, fallback = '-') =>
    normalizeDisplayValue(value) ?? fallback;

const formatGenderLabel = (gender?: string | null) => {
    const normalized = normalizeDisplayValue(gender);
    if (!normalized) return '-';
    if (normalized === 'M') return '남';
    if (normalized === 'F') return '여';
    return normalized;
};

const formatAgeSuffix = (age?: number | null) =>
    Number.isFinite(age) ? `, ${age}세` : '';

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
                        ({formatGenderLabel(patient.gender)}
                        {formatAgeSuffix(patient.age)})
                    </span>
                </div>
                <div className={styles.patientInfoItem}>
                    생년월일: {formatDisplayValue(patient.date_of_birth)}
                </div>
                <div className={styles.patientInfoItem}>
                    연락처: {formatDisplayValue(patient.phone)}
                </div>

                <div className={styles.testBadges}>
                    {labResults.length > 0 && (
                        <span className={`${styles.testBadge} ${styles.completed}`}>
                            혈액검사 완료 ({formatDisplayValue(labResults[0].test_date)})
                        </span>
                    )}
                    {imagingOrders.length > 0 && imagingOrders[0].status === 'COMPLETED' && (
                        <span className={`${styles.testBadge} ${styles.ct}`}>
                            {imagingOrders[0].modality} 완료 (
                            {imagingOrders[0].ordered_at
                                ? new Date(imagingOrders[0].ordered_at).toLocaleDateString()
                                : '-'})
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
