import React from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';
import type { EncounterDetail } from '../../../api/doctorApi';

interface PatientHistorySectionProps {
    encounterHistory: EncounterDetail[];
    questionnaireData: any;
    questionnaireUpdatedAt?: string;
    onDetailClick?: (encounter: EncounterDetail) => void;
}

export default function PatientHistorySection({
    encounterHistory,
    questionnaireData,
    questionnaireUpdatedAt,
    onDetailClick
}: PatientHistorySectionProps) {

    // 문진표 렌더링 헬퍼
    const renderQuestionnaire = (data: any) => {
        if (!data) return null;

        const knownKeysMap: { [key: string]: string } = {
            chief_complaint: '주증상 (C/C)',
            symptoms: '호소 증상',
            medical_history: '과거 병력',
            family_history: '가족력',
            smoking: '흡연',
            alcohol: '음주',
            allergies: '알레르기',
            medications: '복용 약물',
            pain_level: '통증 정도',
            symptom_duration: '증상 지속 기간',
            additional_notes: '추가 사항'
        };

        const formatValue = (key: string, val: any): React.ReactNode => {
            if (val === true) return <span className={styles.tagYes}>예</span>;
            if (val === false) return <span className={styles.tagNo}>아니오</span>;

            // Symptoms / Medical History Object Handling
            if (typeof val === 'object' && val !== null) {
                // Check if it's the "symptoms" or "medical_history" object structure
                if (key === 'symptoms' || key === 'medical_history') {
                    const activeItems = Object.entries(val)
                        .filter(([k, v]) => v === true && k !== 'other')
                        .map(([k]) => k);

                    // Add 'other' if exists
                    // @ts-ignore
                    if (val.other) activeItems.push(`기타: ${val.other}`);

                    if (activeItems.length === 0) return <span className={styles.textMuted}>특이사항 없음</span>;

                    return (
                        <div className={styles.tagContainer}>
                            {activeItems.map((item, idx) => (
                                <span key={idx} className={styles.badgeItem}>{item}</span>
                            ))}
                        </div>
                    );
                }
                // Fallback for other objects
                return JSON.stringify(val);
            }
            if (!val) return <span className={styles.textMuted}>-</span>;
            return <span className={styles.textValue}>{String(val)}</span>;
        };

        // Render groups
        return (
            <div className={styles.questionnaireGrid}>
                {Object.entries(data).map(([key, value]) => {
                    // Skip empty objects/nulls except explicitly handled ones?
                    // Actually show them as '-' if important?
                    const label = knownKeysMap[key] || key;
                    // Skip internal keys or empty complex objects if not handled
                    if (key === 'patient_id') return null;

                    return (
                        <div key={key} className={styles.infoCard}>
                            <div className={styles.infoLabel}>{label}</div>
                            <div className={styles.infoContent}>
                                {formatValue(key, value)}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={styles.leftSection} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 1. 상단: 과거 진료 기록 */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#2c3e50', padding: '10px 0 0 10px' }}>
                    📋 과거 진료기록
                </h3>
                <div className={styles.recordList}>
                    {encounterHistory && encounterHistory.length > 0 ? (
                        encounterHistory.map((encounter) => (
                            <div key={encounter.encounter_id} className={styles.recordItem}>
                                <div className={styles.recordDate}>
                                    {encounter.encounter_date} {encounter.encounter_time}
                                </div>
                                <div className={styles.recordDetail}>
                                    • 담당의사: {encounter.doctor_name || '-'}
                                </div>
                                <div className={styles.recordDetail}>
                                    • 주증상: {encounter.chief_complaint || 'N/A'}
                                </div>
                                <div className={styles.recordDetail}>
                                    • 진단명: {encounter.diagnosis_name || 'N/A'}
                                </div>
                                <button
                                    className={styles.detailButton}
                                    onClick={() => onDetailClick && onDetailClick(encounter)}
                                >
                                    상세보기
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className={styles.emptyRecord}>과거 진료 기록이 없습니다.</div>
                    )}
                </div>
            </div>


            {/* 2. 하단: 문진표 (고정된 섹션) */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#2c3e50', paddingLeft: '10px' }}>
                        📝 문진표
                    </h3>
                    {questionnaireUpdatedAt && (
                        <span style={{ fontSize: '0.8rem', color: '#888', marginRight: '10px' }}>
                            최종수정: {new Date(questionnaireUpdatedAt).toLocaleString()}
                        </span>
                    )}
                </div>

                {questionnaireData ? (
                    <div className={styles.questionnaireData}>
                        {renderQuestionnaire(questionnaireData)}
                    </div>
                ) : (
                    <div className={styles.emptyRecord}>문진표 데이터가 없습니다.</div>
                )}
            </div>
        </div>
    );
}
