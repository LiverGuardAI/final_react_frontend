import React, { useEffect, useState } from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';
import type { EncounterDetail, QuestionnaireRecord, VitalRecord } from '../../../api/doctorApi';

interface PatientHistorySectionProps {
    encounterHistory: EncounterDetail[];
    questionnaireList?: QuestionnaireRecord[];
    vitalList?: VitalRecord[];
}

export default function PatientHistorySection({
    encounterHistory,
    questionnaireList = [],
    vitalList = []
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

    const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | null>(null);

    useEffect(() => {
        if (questionnaireList.length === 0) {
            setSelectedQuestionnaireId(null);
            return;
        }
        setSelectedQuestionnaireId((prev) => {
            if (prev && questionnaireList.some((item) => item.questionnaire_id === prev)) {
                return prev;
            }
            return questionnaireList[0].questionnaire_id;
        });
    }, [questionnaireList]);

    const selectedQuestionnaire =
        questionnaireList.find((item) => item.questionnaire_id === selectedQuestionnaireId) ||
        questionnaireList[0];

    const formatQuestionnaireLabel = (item: QuestionnaireRecord) => {
        if (!item?.updated_at) {
            return `문진표 ${item.questionnaire_id}`;
        }
        const date = new Date(item.updated_at);
        if (Number.isNaN(date.getTime())) {
            return `문진표 ${item.questionnaire_id}`;
        }
        return date.toLocaleString();
    };

    type VitalMetric = 'bp' | 'hr' | 'temp';

    const [selectedVitalId, setSelectedVitalId] = useState<number | null>(null);
    const [selectedVitalMetric, setSelectedVitalMetric] = useState<VitalMetric | null>(null);

    useEffect(() => {
        if (vitalList.length === 0) {
            setSelectedVitalId(null);
            return;
        }
        setSelectedVitalId((prev) => {
            if (prev && vitalList.some((item) => item.vital_id === prev)) {
                return prev;
            }
            return vitalList[0].vital_id;
        });
    }, [vitalList]);

    const hasBloodPressure = vitalList.some(
        (item) => (item.sbp ?? item.systolic_bp) || (item.dbp ?? item.diastolic_bp)
    );
    const hasHeartRate = vitalList.some((item) => (item.heart_rate ?? item.heartRate));
    const hasTemperature = vitalList.some((item) => (item.temperature ?? item.body_temperature));

    useEffect(() => {
        if (vitalList.length === 0) {
            setSelectedVitalMetric(null);
            return;
        }
        const available: VitalMetric[] = [];
        if (hasBloodPressure) available.push('bp');
        if (hasHeartRate) available.push('hr');
        if (hasTemperature) available.push('temp');
        setSelectedVitalMetric((prev) => {
            if (prev && available.includes(prev)) {
                return prev;
            }
            return available[0] || null;
        });
    }, [vitalList, hasBloodPressure, hasHeartRate, hasTemperature]);

    const selectedVital =
        vitalList.find((item) => item.vital_id === selectedVitalId) || vitalList[0];

    const systolic = selectedVital?.sbp ?? selectedVital?.systolic_bp;
    const diastolic = selectedVital?.dbp ?? selectedVital?.diastolic_bp;
    const heartRate = selectedVital?.heart_rate ?? selectedVital?.heartRate;
    const temperature = selectedVital?.temperature ?? selectedVital?.body_temperature;

    const formatDateTime = (value?: string) => {
        if (!value) return '-';
        try {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleDateString();
            }
        } catch (error) {
            // fall through
        }
        return value;
    };

    const formatVitalLabel = (item: VitalRecord) => {
        if (!item?.measured_at) {
            return `기록 ${item.vital_id}`;
        }
        const date = new Date(item.measured_at);
        if (Number.isNaN(date.getTime())) {
            return `기록 ${item.vital_id}`;
        }
        return date.toLocaleDateString();
    };

    const formatVitalNumber = (value?: number | string | null, digits = 1) => {
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        const numericValue = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numericValue)) {
            return '-';
        }
        return numericValue.toFixed(digits);
    };

    const chartData = React.useMemo(() => {
        if (!selectedVitalMetric || vitalList.length === 0) {
            return null;
        }
        const sorted = [...vitalList].sort((a, b) => {
            const aTime = new Date(a.measured_at || '').getTime();
            const bTime = new Date(b.measured_at || '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
                return 0;
            }
            return aTime - bTime;
        });

        const labels = sorted.map((item) => item.measured_at || '');
        const series: Array<{ label: string; color: string; values: Array<number | null> }> = [];

        if (selectedVitalMetric === 'bp') {
            series.push({
                label: '수축기',
                color: '#6C5CE7',
                values: sorted.map((item) => (item.sbp ?? item.systolic_bp) ?? null),
            });
            series.push({
                label: '이완기',
                color: '#9B8AFB',
                values: sorted.map((item) => (item.dbp ?? item.diastolic_bp) ?? null),
            });
        } else if (selectedVitalMetric === 'hr') {
            series.push({
                label: '심박수',
                color: '#0EA5E9',
                values: sorted.map((item) => (item.heart_rate ?? item.heartRate) ?? null),
            });
        } else if (selectedVitalMetric === 'temp') {
            series.push({
                label: '체온',
                color: '#F97316',
                values: sorted.map((item) => (item.temperature ?? item.body_temperature) ?? null),
            });
        }

        const allValues = series.flatMap((item) => item.values).filter((value) => value !== null) as number[];
        if (allValues.length === 0) {
            return null;
        }

        let minValue = Math.min(...allValues);
        let maxValue = Math.max(...allValues);
        if (minValue === maxValue) {
            minValue -= 1;
            maxValue += 1;
        }

        return {
            labels,
            series,
            minValue,
            maxValue,
        };
    }, [selectedVitalMetric, vitalList]);

    const formatEncounterDate = (encounter: EncounterDetail) => {
        const date = (encounter as any).record_date || (encounter as any).encounter_date;
        if (!date) {
            return '-';
        }
        return date;
    };

    const handleDetailOpen = (event: React.MouseEvent<HTMLButtonElement>, encounter: EncounterDetail) => {
        event.preventDefault();
        event.stopPropagation();
        const url = `/doctor/encounter/${encounter.encounter_id}`;
        const popup = window.open(url, '_blank', 'width=900,height=720');
        if (popup) {
            popup.opener = null;
            popup.focus?.();
            return;
        }
        alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.');
    };

    return (
        <div className={styles.leftSection}>
            <div className={styles.historyStack}>
                <div className={styles.historyCard}>
                    <div className={styles.cardHeaderRow}>
                        <h3 className={styles.cardTitle}>진료기록</h3>
                    </div>
                    <div className={styles.cardBody}>
                        <div className={styles.recordList}>
                            {encounterHistory && encounterHistory.length > 0 ? (
                                <>
                                    <div className={styles.recordHeader}>
                                        <span>진료일</span>
                                        <span>진료의사</span>
                                        <span>주증상</span>
                                        <span>진료내용</span>
                                        <span className={styles.recordHeaderAction}> </span>
                                    </div>
                                    {encounterHistory.map((encounter) => (
                                        <div key={encounter.encounter_id} className={styles.recordItem}>
                                            <div className={styles.recordCell}>
                                                {formatEncounterDate(encounter)}
                                            </div>
                                            <div className={styles.recordCell}>
                                                {encounter.doctor_name || '-'}
                                            </div>
                                            <div className={styles.recordCell}>
                                                {encounter.chief_complaint || 'N/A'}
                                            </div>
                                            <div className={styles.recordCell}>
                                                {encounter.clinical_notes || 'N/A'}
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.detailButton}
                                                onClick={(event) => handleDetailOpen(event, encounter)}
                                            >
                                                상세보기
                                            </button>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className={styles.emptyRecord}>과거 진료 기록이 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.historyCard}>
                    <div className={styles.cardHeaderRow}>
                        <h3 className={styles.cardTitle}>문진표</h3>
                        <div className={styles.cardHeaderActions}>
                            {questionnaireList.length > 0 && (
                                <select
                                    className={styles.cardSelect}
                                    value={selectedQuestionnaire?.questionnaire_id ?? ''}
                                    onChange={(event) => setSelectedQuestionnaireId(Number(event.target.value))}
                                >
                                    {questionnaireList.map((item) => (
                                        <option key={item.questionnaire_id} value={item.questionnaire_id}>
                                            {formatQuestionnaireLabel(item)}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {selectedQuestionnaire?.updated_at && (
                                <span className={styles.cardMeta}>
                                    최종수정: {new Date(selectedQuestionnaire.updated_at).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className={styles.cardBody}>
                        <div className={styles.questionnaireData}>
                            {selectedQuestionnaire?.data ? (
                                renderQuestionnaire(selectedQuestionnaire.data)
                            ) : (
                                <div className={styles.emptyRecord}>문진표 데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.historyCard}>
                    <div className={styles.cardHeaderRow}>
                        <h3 className={styles.cardTitle}>바이탈 정보</h3>
                        <div className={styles.cardHeaderActions}>
                            {vitalList.length > 0 && (
                                <select
                                    className={styles.cardSelect}
                                    value={selectedVital?.vital_id ?? ''}
                                    onChange={(event) => setSelectedVitalId(Number(event.target.value))}
                                >
                                    {vitalList.map((item) => (
                                        <option key={item.vital_id} value={item.vital_id}>
                                            {formatVitalLabel(item)}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <div className={styles.cardBody}>
                        <div className={styles.vitalContent}>
                            {selectedVital ? (
                                <>
                                    <div className={styles.vitalGrid}>
                                        <button
                                            type="button"
                                            className={`${styles.infoCard} ${styles.vitalCard} ${selectedVitalMetric === 'bp' ? styles.vitalCardActive : ''}`}
                                            onClick={() => setSelectedVitalMetric('bp')}
                                            disabled={!hasBloodPressure}
                                        >
                                        <div className={styles.infoLabel}>혈압</div>
                                        <div className={styles.infoContent}>
                                            {systolic && diastolic ? `${systolic}/${diastolic} mmHg` : '-'}
                                        </div>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.infoCard} ${styles.vitalCard} ${selectedVitalMetric === 'hr' ? styles.vitalCardActive : ''}`}
                                            onClick={() => setSelectedVitalMetric('hr')}
                                            disabled={!hasHeartRate}
                                        >
                                        <div className={styles.infoLabel}>심박수</div>
                                        <div className={styles.infoContent}>
                                            {heartRate ? `${formatVitalNumber(heartRate, 0)} bpm` : '-'}
                                        </div>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.infoCard} ${styles.vitalCard} ${selectedVitalMetric === 'temp' ? styles.vitalCardActive : ''}`}
                                            onClick={() => setSelectedVitalMetric('temp')}
                                            disabled={!hasTemperature}
                                        >
                                        <div className={styles.infoLabel}>체온</div>
                                        <div className={styles.infoContent}>
                                            {temperature ? `${formatVitalNumber(temperature, 1)} °C` : '-'}
                                        </div>
                                        </button>
                                    </div>
                                    {chartData ? (
                                        <div className={styles.vitalChart}>
                                            <div className={styles.vitalChartHeader}>
                                                {selectedVitalMetric === 'bp' && '혈압 변화'}
                                                {selectedVitalMetric === 'hr' && '심박수 변화'}
                                                {selectedVitalMetric === 'temp' && '체온 변화'}
                                            </div>
                                            <svg className={styles.vitalChartSvg} viewBox="0 0 600 160" preserveAspectRatio="none">
                                                {chartData.series.map((seriesItem, seriesIndex) => {
                                                    const padding = 24;
                                                    const width = 600;
                                                    const height = 160;
                                                    const usableWidth = width - padding * 2;
                                                    const usableHeight = height - padding * 2;
                                                    const step = chartData.labels.length > 1
                                                        ? usableWidth / (chartData.labels.length - 1)
                                                        : 0;
                                                    const pointList = seriesItem.values
                                                        .map((value, index) => {
                                                            if (value === null || value === undefined) {
                                                                return null;
                                                            }
                                                            const x = padding + index * step;
                                                            const ratio = (value - chartData.minValue) / (chartData.maxValue - chartData.minValue);
                                                            const y = height - padding - ratio * usableHeight;
                                                            return { x, y };
                                                        })
                                                        .filter(Boolean) as Array<{ x: number; y: number }>;
                                                    const points = pointList.map((point) => `${point.x},${point.y}`).join(' ');

                                                    return (
                                                        <g key={`${seriesItem.label}-${seriesIndex}`}>
                                                            <polyline
                                                                fill="none"
                                                                stroke={seriesItem.color}
                                                                strokeWidth="2"
                                                                points={points}
                                                            />
                                                            {pointList.map((point, index) => (
                                                                <circle
                                                                    key={`${seriesItem.label}-point-${index}`}
                                                                    cx={point.x}
                                                                    cy={point.y}
                                                                    r="3"
                                                                    fill={seriesItem.color}
                                                                />
                                                            ))}
                                                        </g>
                                                    );
                                                })}
                                            </svg>
                                            <div className={styles.vitalChartLegend}>
                                                {chartData.series.map((seriesItem) => (
                                                    <span key={seriesItem.label} className={styles.vitalLegendItem}>
                                                        <span
                                                            className={styles.vitalLegendDot}
                                                            style={{ backgroundColor: seriesItem.color }}
                                                        />
                                                        {seriesItem.label}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className={styles.vitalChartFooter}>
                                                <span>{chartData.labels[0] ? formatDateTime(chartData.labels[0]) : '-'}</span>
                                                <span>
                                                    {chartData.labels[chartData.labels.length - 1]
                                                        ? formatDateTime(chartData.labels[chartData.labels.length - 1])
                                                        : '-'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={styles.vitalChartEmpty}>그래프를 표시할 데이터가 없습니다.</div>
                                    )}
                                </>
                            ) : (
                                <div className={styles.emptyRecord}>바이탈 데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
