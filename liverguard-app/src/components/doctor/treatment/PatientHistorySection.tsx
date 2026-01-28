import React, { useEffect, useRef, useState } from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';
import type {
    EncounterDetail,
    GenomicDataItem,
    LabResult,
    QuestionnaireRecord,
    VitalRecord,
} from '../../../api/doctorApi';

interface PatientHistorySectionProps {
    encounterHistory: EncounterDetail[];
    questionnaireList?: QuestionnaireRecord[];
    vitalList?: VitalRecord[];
    labResults?: LabResult[];
    genomicData?: GenomicDataItem[];
}

export default function PatientHistorySection({
    encounterHistory,
    questionnaireList = [],
    vitalList = [],
    labResults = [],
    genomicData = []
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

            if (key === 'smoking' || key === 'alcohol') {
                if (!val) return <span className={styles.textMuted}>특이사항 없음</span>;
                const normalized = String(val).trim().toLowerCase();
                if (normalized === 'none') return <span className={styles.tagNo}>No</span>;
                return <span className={styles.tagYes}>Yes</span>;
            }

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
            if (!val) return <span className={styles.textMuted}>특이사항 없음</span>;
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
    const hasQuestionnaireData = Boolean(selectedQuestionnaire?.data);

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
    const [vitalTab, setVitalTab] = useState<'vital' | 'lab' | 'genetic'>('vital');
    const [selectedLabMetric, setSelectedLabMetric] = useState<string | null>(null);
    const [selectedGenomicMetric, setSelectedGenomicMetric] = useState<string | null>(null);
    const chartScrollRef = useRef<HTMLDivElement | null>(null);
    const labGridRef = useRef<HTMLDivElement | null>(null);
    const genomicGridRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const scrollStartRef = useRef(0);
    const dragAccumulatorRef = useRef(0);
    const [viewStart, setViewStart] = useState(0);
    const viewStartRef = useRef(0);
    const chartDataRef = useRef<typeof chartData | null>(null);

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
            setSelectedVitalMetric((prev) => prev ?? 'bp');
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
            return available[0] || 'bp';
        });
    }, [vitalList, hasBloodPressure, hasHeartRate, hasTemperature]);

    const selectedVital =
        vitalList.find((item) => item.vital_id === selectedVitalId) || vitalList[0];
    const showVitalTab = vitalTab === 'vital';

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

    const formatLabDisplayValue = (key: string, value: unknown) => {
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        if (key === 'child_pugh_class') {
            if (typeof value === 'string') {
                return value.trim().toUpperCase();
            }
            if (typeof value === 'number') {
                if (value == 1) return 'A';
                if (value == 2) return 'B';
                if (value == 3) return 'C';
            }
        }
        if (key === 'albi_grade') {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return String(Math.round(value));
            }
            if (typeof value === 'string') {
                const numericValue = Number(value);
                if (Number.isFinite(numericValue)) {
                    return String(Math.round(numericValue));
                }
            }
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value.toFixed(2);
        }
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
            return numericValue.toFixed(2);
        }
        return '-';
    };

    const formatLabPointValue = (key: string | null, value: number) => {
        if (key === 'child_pugh_class') {
            if (value === 1) return 'A';
            if (value === 2) return 'B';
            if (value === 3) return 'C';
        }
        if (key === 'albi_grade') {
            return String(Math.round(value));
        }
        return formatVitalNumber(value, 2);
    };

    const formatLabAxisTick = (key: string | null, value: number) => {
        if (key === 'child_pugh_class') {
            if (value === 1) return 'A';
            if (value === 2) return 'B';
            if (value === 3) return 'C';
        }
        if (key === 'albi_grade') {
            if (value === 1) return '1';
            if (value === 2) return '2';
            if (value === 3) return '3';
        }
        return formatVitalNumber(value, 0);
    };


    const toLabChartValue = (key: string, value: unknown) => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toUpperCase();
            if (key === 'child_pugh_class' || key === 'albi_grade') {
                if (normalized === 'A') return 1;
                if (normalized === 'B') return 2;
                if (normalized === 'C') return 3;
            }
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? numericValue : null;
        }
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : null;
    };


    const sortedVitals = React.useMemo(() => {
        return [...vitalList].sort((a, b) => {
            const aTime = new Date(a.measured_at || '').getTime();
            const bTime = new Date(b.measured_at || '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
                return 0;
            }
            return aTime - bTime;
        });
    }, [vitalList]);

    const sortedLabs = React.useMemo(() => {
        return [...labResults].sort((a, b) => {
            const aTime = new Date(a.measured_at || a.test_date || a.created_at || '').getTime();
            const bTime = new Date(b.measured_at || b.test_date || b.created_at || '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
                return 0;
            }
            return aTime - bTime;
        });
    }, [labResults]);

    const sortedGenomics = React.useMemo(() => {
        return [...genomicData].sort((a, b) => {
            const aTime = new Date(a.measured_at || a.sample_date || a.created_at || '').getTime();
            const bTime = new Date(b.measured_at || b.sample_date || b.created_at || '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
                return 0;
            }
            return aTime - bTime;
        });
    }, [genomicData]);

    const latestLab = sortedLabs[sortedLabs.length - 1];
    const latestGenomic = sortedGenomics[sortedGenomics.length - 1];

    useEffect(() => {
        const visibleCount = 10;
        const totalPoints = vitalTab === 'vital'
            ? sortedVitals.length
            : vitalTab === 'lab'
                ? sortedLabs.length
                : sortedGenomics.length;
        const maxStart = Math.max(0, totalPoints - visibleCount);
        setViewStart(maxStart);
    }, [sortedVitals, sortedLabs, sortedGenomics, vitalTab]);

    const labMetricOptions = React.useMemo(
        () => [
            { key: 'afp', label: 'afp', color: '#F97316', normalRange: { max: 10 } },
            { key: 'albumin', label: 'albumin', color: '#0EA5E9', normalRange: { min: 3.5, max: 5.5 } },
            { key: 'bilirubin_total', label: 'bilirubin total', color: '#EAB308', normalRange: { max: 1.2 } },
            { key: 'pt_inr', label: 'pt inr', color: '#6366F1', normalRange: { min: 0.8, max: 1.2 } },
            { key: 'platelet', label: 'platelet', color: '#10B981', normalRange: { min: 150, max: 450 } },
            { key: 'creatinine', label: 'creatinine', color: '#EC4899', normalRange: { min: 0.6, max: 1.2 } },
            { key: 'child_pugh_class', label: 'child pugh class', color: '#8B5CF6' },
            { key: 'meld_score', label: 'meld score', color: '#14B8A6', normalRange: { max: 20 } },
            { key: 'albi_score', label: 'albi score', color: '#F43F5E', normalRange: { max: -1.39 } },
            { key: 'albi_grade', label: 'albi grade', color: '#64748B' },
        ],
        []
    );

    const availableLabMetrics = React.useMemo(() => {
        return labMetricOptions;
    }, [labMetricOptions]);

    useEffect(() => {
        if (availableLabMetrics.length === 0) {
            setSelectedLabMetric(null);
            return;
        }
        setSelectedLabMetric((prev) => {
            if (prev && availableLabMetrics.some((item) => item.key === prev)) {
                return prev;
            }
            return availableLabMetrics[0].key;
        });
    }, [availableLabMetrics]);

    const genomicMetricColors = ['#F97316', '#EAB308', '#0EA5E9', '#6366F1', '#10B981', '#EC4899'];

    const getMetricColor = (key: string, palette: string[]) => {
        let hash = 0;
        for (let i = 0; i < key.length; i += 1) {
            hash = (hash * 31 + key.charCodeAt(i)) % palette.length;
        }
        return palette[hash % palette.length];
    };

    const chartData = React.useMemo(() => {
        const visibleCount = 10;
        const activeType = vitalTab;
        const series: Array<{ label: string; color: string; values: Array<number | null> }> = [];
        let labels: string[] = [];
        let normalBounds: { min?: number; max?: number } | null = null;

        if (activeType === 'vital') {
            if (!selectedVitalMetric || sortedVitals.length === 0) {
                return null;
            }
            labels = sortedVitals.map((item) => item.measured_at || '');
            if (selectedVitalMetric === 'bp') {
                series.push({
                    label: '수축기',
                    color: '#4C3FFF',
                    values: sortedVitals.map((item) => (item.sbp ?? item.systolic_bp) ?? null),
                });
                series.push({
                    label: '이완기',
                    color: '#B294FF',
                    values: sortedVitals.map((item) => (item.dbp ?? item.diastolic_bp) ?? null),
                });
                normalBounds = { min: 60, max: 120 };
            } else if (selectedVitalMetric === 'hr') {
                series.push({
                    label: '심박수',
                    color: '#0EA5E9',
                    values: sortedVitals.map((item) => (item.heart_rate ?? item.heartRate) ?? null),
                });
                normalBounds = { min: 60, max: 100 };
            } else if (selectedVitalMetric === 'temp') {
                series.push({
                    label: '체온',
                    color: '#F97316',
                    values: sortedVitals.map((item) => (item.temperature ?? item.body_temperature) ?? null),
                });
                normalBounds = { min: 36.5, max: 37.5 };
            }
        } else if (activeType === 'lab') {
            if (!selectedLabMetric || sortedLabs.length === 0) {
                return null;
            }
            const selectedOption = labMetricOptions.find((option) => option.key === selectedLabMetric);
            labels = sortedLabs.map((item) => item.measured_at || item.test_date || item.created_at || '');
            series.push({
                label: selectedOption?.label || (selectedLabMetric ? selectedLabMetric.replace(/_/g, ' ') : ''),
                color: selectedOption?.color || '#10B981',
                values: sortedLabs.map((item) => toLabChartValue(selectedLabMetric, (item as any)[selectedLabMetric])),
            });
            if (selectedOption?.normalRange) {
                normalBounds = selectedOption.normalRange;
            }
        } else if (activeType === 'genetic') {
            if (!selectedGenomicMetric || sortedGenomics.length === 0) {
                return null;
            }
            labels = sortedGenomics.map((item) => item.measured_at || item.sample_date || item.created_at || '');
            series.push({
                label: selectedGenomicMetric,
                color: getMetricColor(selectedGenomicMetric, genomicMetricColors),
                values: sortedGenomics.map((item) => item.pathway_scores?.[selectedGenomicMetric] ?? null),
            });
        }

        if (series.length === 0) {
            return null;
        }

        const allValues = series.flatMap((item) => item.values).filter((value) => value !== null) as number[];
        if (allValues.length === 0) {
            return null;
        }

        let minValue = Math.min(...allValues);
        let maxValue = Math.max(...allValues);
        if (normalBounds) {
            if (normalBounds.min !== undefined) {
                minValue = Math.min(minValue, normalBounds.min);
            }
            if (normalBounds.max !== undefined) {
                maxValue = Math.max(maxValue, normalBounds.max);
            }
        }
        if (minValue === maxValue) {
            minValue -= 1;
            maxValue += 1;
        }
        const padding = Math.max((maxValue - minValue) * 0.15, 1);
        minValue -= padding;
        maxValue += padding;

        const totalPoints = labels.length;
        const maxStart = Math.max(0, totalPoints - visibleCount);
        const clampedStart = Math.min(Math.max(viewStart, 0), maxStart);
        const end = Math.min(totalPoints, clampedStart + visibleCount);
        const windowLabels = labels.slice(clampedStart, end);
        const windowSeries = series.map((item) => ({
            ...item,
            values: item.values.slice(clampedStart, end),
        }));

        return {
            labels: windowLabels,
            series: windowSeries,
            minValue,
            maxValue,
            totalPoints,
            startIndex: clampedStart,
            endIndex: end,
            normalBounds,
        };
    }, [selectedVitalMetric, selectedLabMetric, selectedGenomicMetric, sortedVitals, sortedLabs, sortedGenomics, viewStart, vitalTab]);

    useEffect(() => {
        viewStartRef.current = viewStart;
    }, [viewStart]);

    useEffect(() => {
        chartDataRef.current = chartData;
    }, [chartData]);

    useEffect(() => {
        const el = chartScrollRef.current;
        if (!el) {
            return;
        }
        const onWheel = (event: WheelEvent) => {
            const current = chartDataRef.current;
            if (!current) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const dominantDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
            const direction = dominantDelta > 0 ? 1 : -1;
            const visibleCount = 10;
            const maxStart = Math.max(0, current.totalPoints - visibleCount);
            const next = Math.min(Math.max(viewStartRef.current + direction, 0), maxStart);
            if (next !== viewStartRef.current) {
                setViewStart(next);
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
        };
    }, []);

    const handleChartMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!chartData) {
            return;
        }
        isDraggingRef.current = true;
        dragStartXRef.current = event.clientX;
        scrollStartRef.current = viewStart;
        dragAccumulatorRef.current = 0;
    };

    const handleChartMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!chartData || !isDraggingRef.current) {
            return;
        }
        const delta = event.clientX - dragStartXRef.current;
        dragAccumulatorRef.current = delta;
        const stepPx = 30;
        const steps = Math.trunc(dragAccumulatorRef.current / stepPx);
        if (steps === 0) {
            return;
        }
        const visibleCount = 10;
        const maxStart = Math.max(0, chartData.totalPoints - visibleCount);
        const next = Math.min(Math.max(scrollStartRef.current - steps, 0), maxStart);
        setViewStart(next);
    };

    const handleChartMouseUp = () => {
        isDraggingRef.current = false;
    };

    const handleChartMouseLeave = () => {
        isDraggingRef.current = false;
    };

    const scrollMetricGrid = (ref: React.RefObject<HTMLDivElement>, direction: number) => {
        const target = ref.current;
        if (!target) {
            return;
        }
        target.scrollBy({ left: direction * 240, behavior: 'smooth' });
    };


    const genomicMetricOptions = React.useMemo(() => {
        const keys = new Set<string>();
        sortedGenomics.forEach((item) => {
            Object.keys(item.pathway_scores || {}).forEach((key) => keys.add(key));
        });
        return Array.from(keys);
    }, [sortedGenomics]);

    const defaultGenomicMetrics = [
        'DNA Repair',
        'Glycolysis',
        'Coagulation',
        'E2F Targets',
        'Adipogenesis',
        'Myc Targets V1',
        'Myc Targets V2',
        'UV Response Up',
        'G2-M Checkpoint',
        'Mitotic Spindle',
        'Spermatogenesis',
        'mTORC1 Signaling',
        'KRAS Signaling DN',
        'Bile Acid Metabolism',
        'Fatty Acid Metabolism',
        'Xenobiotic Metabolism',
        'PI3K/AKT/mTOR Signaling',
        'Oxidative Phosphorylation',
        'Unfolded Protein Response',
        'Reactive Oxygen Species Pathway',
    ];
    const genomicMetricsToShow = genomicMetricOptions.length > 0
        ? genomicMetricOptions
        : defaultGenomicMetrics;
    const isGenomicPlaceholder = genomicMetricOptions.length === 0;

    useEffect(() => {
        if (genomicMetricOptions.length === 0) {
            setSelectedGenomicMetric((prev) => prev ?? defaultGenomicMetrics[0]);
            return;
        }
        setSelectedGenomicMetric((prev) => {
            if (prev && genomicMetricOptions.includes(prev)) {
                return prev;
            }
            return genomicMetricOptions[0];
        });
    }, [genomicMetricOptions]);

    const chartTitle = React.useMemo(() => {
        if (vitalTab === 'vital') {
            if (selectedVitalMetric === 'bp') return '혈압 변화';
            if (selectedVitalMetric === 'hr') return '심박수 변화';
            if (selectedVitalMetric === 'temp') return '체온 변화';
            return '바이탈 변화';
        }
        if (vitalTab === 'lab') {
            return availableLabMetrics.find((item) => item.key === selectedLabMetric)?.label || '혈액검사';
        }
        return selectedGenomicMetric || '유전체 검사';
    }, [vitalTab, selectedVitalMetric, selectedLabMetric, selectedGenomicMetric, availableLabMetrics]);

    const formatEncounterDate = (encounter: EncounterDetail) => {
        const date = (encounter as any).record_date || (encounter as any).encounter_date;
        if (!date) {
            return '-';
        }
        return date;
    };

    const [expandedEncounterId, setExpandedEncounterId] = useState<number | null>(null);

    const toggleEncounterDetail = (encounterId?: number) => {
        if (encounterId === undefined || !Number.isFinite(Number(encounterId))) {
            return;
        }
        setExpandedEncounterId((prev) => (prev === encounterId ? null : encounterId));
    };

    const formatEncounterField = (value?: string | number | null) => {
        if (value === null || value === undefined) {
            return '-';
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed || trimmed.toUpperCase() === 'N/A') {
                return '-';
            }
            return trimmed;
        }
        return String(value);
    };

    const formatFlag = (value?: boolean) => (value ? '\uC608' : '\uC544\uB2C8\uC624');

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
                                    {encounterHistory.map((encounter, idx) => {
                                        const encounterKey = encounter.encounter_id
                                            ?? (encounter as any).id
                                            ?? (encounter as any).record_id;
                                        const encounterKeyNumber = Number(encounterKey);
                                        const keyValue = Number.isFinite(encounterKeyNumber) ? encounterKeyNumber : idx;
                                        const isExpanded = expandedEncounterId === keyValue;
                                        return (
                                            <div key={keyValue}>
                                                <div
                                                    className={styles.recordItem}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => toggleEncounterDetail(keyValue)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter" || event.key === " ") {
                                                            event.preventDefault();
                                                            toggleEncounterDetail(keyValue);
                                                        }
                                                    }}
                                                >
                                                    <div className={styles.recordCell}>
                                                        {formatEncounterDate(encounter)}
                                                    </div>
                                                    <div className={styles.recordCell}>
                                                        {formatEncounterField(encounter.doctor_name)}
                                                    </div>
                                                    <div className={styles.recordCell}>
                                                        {formatEncounterField(encounter.chief_complaint)}
                                                    </div>
                                                    <div className={styles.recordCell}>
                                                        {formatEncounterField(encounter.clinical_notes)}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={`${styles.detailButton} ${styles.detailToggleButton} ${isExpanded ? styles.detailButtonActive : ''}`}
                                                        aria-label={isExpanded ? '\uC0C1\uC138 \uB2EB\uAE30' : '\uC0C1\uC138 \uD3BC\uCE58\uAE30'}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            toggleEncounterDetail(keyValue);
                                                        }}
                                                    >
                                                        {isExpanded ? (
                                                            <svg className={styles.chevronIcon} viewBox="0 0 24 24" aria-hidden="true">
                                                                <path d="M4 14L12 8L20 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        ) : (
                                                            <svg className={styles.chevronIcon} viewBox="0 0 24 24" aria-hidden="true">
                                                                <path d="M4 10L12 16L20 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className={styles.recordDetailRow}>
                                                        <div className={styles.recordDetailGrid}>
                                                            <div className={styles.recordDetailSection}>
                                                                <span className={styles.recordDetailLabel}>주증상</span>
                                                                <p className={styles.recordDetailText}>
                                                                    {formatEncounterField(encounter.chief_complaint)}
                                                                </p>
                                                            </div>
                                                            <div className={styles.recordDetailSection}>
                                                                <span className={styles.recordDetailLabel}>진료 내용</span>
                                                                <p className={styles.recordDetailText}>
                                                                    {formatEncounterField(encounter.clinical_notes)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
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
                        </div>
                    </div>
                    <div className={styles.cardBody}>
                        <div
                            className={`${styles.questionnaireData} ${!hasQuestionnaireData ? styles.questionnaireEmpty : ''}`}
                        >
                            {hasQuestionnaireData ? (
                                renderQuestionnaire(selectedQuestionnaire.data)
                            ) : (
                                <div className={styles.emptyRecord}>문진표 데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.historyCard}>
                    <div className={styles.cardHeaderRow}>
                        <div className={styles.vitalTabs}>
                            <button
                                type="button"
                                className={`${styles.vitalTabButton} ${vitalTab === 'vital' ? styles.vitalTabButtonActive : ''}`}
                                onClick={() => setVitalTab('vital')}
                            >
                                바이탈
                            </button>
                            <button
                                type="button"
                                className={`${styles.vitalTabButton} ${vitalTab === 'lab' ? styles.vitalTabButtonActive : ''}`}
                                onClick={() => setVitalTab('lab')}
                            >
                                혈액검사
                            </button>
                            <button
                                type="button"
                                className={`${styles.vitalTabButton} ${vitalTab === 'genetic' ? styles.vitalTabButtonActive : ''}`}
                                onClick={() => setVitalTab('genetic')}
                            >
                                유전체 검사
                            </button>
                        </div>
                        <div className={styles.cardHeaderActions}>
                            {vitalTab === 'vital' && vitalList.length > 0 && (
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
                            {showVitalTab && (
                                <div className={styles.vitalGrid}>
                                    <button
                                        type="button"
                                        className={`${styles.infoCard} ${styles.vitalCard} ${!selectedVital ? styles.infoCardEmpty : ''} ${selectedVitalMetric === 'bp' ? styles.vitalCardActive : ''}`}
                                        onClick={() => setSelectedVitalMetric('bp')}
                                    >
                                        <div className={styles.infoLabel}>혈압</div>
                                        <div className={styles.infoContent}>
                                            {systolic && diastolic ? `${systolic}/${diastolic} mmHg` : '-'}
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.infoCard} ${styles.vitalCard} ${!selectedVital ? styles.infoCardEmpty : ''} ${selectedVitalMetric === 'hr' ? styles.vitalCardActive : ''}`}
                                        onClick={() => setSelectedVitalMetric('hr')}
                                    >
                                        <div className={styles.infoLabel}>심박수</div>
                                        <div className={styles.infoContent}>
                                            {heartRate ? `${formatVitalNumber(heartRate, 0)} bpm` : '-'}
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.infoCard} ${styles.vitalCard} ${!selectedVital ? styles.infoCardEmpty : ''} ${selectedVitalMetric === 'temp' ? styles.vitalCardActive : ''}`}
                                        onClick={() => setSelectedVitalMetric('temp')}
                                    >
                                        <div className={styles.infoLabel}>체온</div>
                                        <div className={styles.infoContent}>
                                            {temperature ? `${formatVitalNumber(temperature, 1)} °C` : '-'}
                                        </div>
                                    </button>
                                </div>
                            )}
                                                        {vitalTab === 'lab' && availableLabMetrics.length === 0 && (
                                <div className={styles.vitalGrid}>
                                    <div className={`${styles.infoCard} ${styles.vitalCard} ${styles.infoCardEmpty}`}>
                                        <div className={styles.infoLabel}>afp</div>
                                        <div className={styles.infoContent}>-</div>
                                    </div>
                                    <div className={`${styles.infoCard} ${styles.vitalCard} ${styles.infoCardEmpty}`}>
                                        <div className={styles.infoLabel}>albumin</div>
                                        <div className={styles.infoContent}>-</div>
                                    </div>
                                    <div className={`${styles.infoCard} ${styles.vitalCard} ${styles.infoCardEmpty}`}>
                                        <div className={styles.infoLabel}>bilirubin total</div>
                                        <div className={styles.infoContent}>-</div>
                                    </div>
                                </div>
                            )}
{vitalTab === 'lab' && availableLabMetrics.length > 0 && (
                                <div className={styles.vitalGridScroller}>
                                    <button
                                        type="button"
                                        className={styles.vitalGridNav}
                                        onClick={() => scrollMetricGrid(labGridRef, -1)}
                                        aria-label="Scroll left"
                                    >
                                        <span>{'<'}</span>
                                    </button>
                                    <div className={styles.vitalGridViewport} ref={labGridRef}>
                                        <div className={styles.vitalGrid}>
                                            {availableLabMetrics.map((metric) => {
                                                const value = latestLab ? (latestLab as any)[metric.key] : null;
                                                return (
                                                    <button
                                                        key={metric.key}
                                                        type="button"
                                                        className={`${styles.infoCard} ${styles.vitalCard} ${selectedLabMetric === metric.key ? styles.vitalCardActive : ''}`}
                                                        onClick={() => setSelectedLabMetric(metric.key)}
                                                    >
                                                        <div className={styles.infoLabel}>{metric.label}</div>
                                                        <div className={styles.infoContent}>{formatLabDisplayValue(metric.key, value)}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.vitalGridNav}
                                        onClick={() => scrollMetricGrid(labGridRef, 1)}
                                        aria-label="Scroll right"
                                    >
                                        <span>{'>'}</span>
                                    </button>
                                </div>
                            )}
                            {vitalTab === 'genetic' && genomicMetricsToShow.length > 0 && (
                                <div className={styles.vitalGridScroller}>
                                    <button
                                        type="button"
                                        className={styles.vitalGridNav}
                                        onClick={() => scrollMetricGrid(genomicGridRef, -1)}
                                        aria-label="Scroll left"
                                    >
                                        <span>{'<'}</span>
                                    </button>
                                    <div className={styles.vitalGridViewport} ref={genomicGridRef}>
                                        <div className={styles.vitalGrid}>
                                            {genomicMetricsToShow.map((metric) => {
                                                const value = latestGenomic?.pathway_scores?.[metric] ?? null;
                                                const isActive = selectedGenomicMetric === metric;
                                                return (
                                                    <button
                                                        key={metric}
                                                        type="button"
                                                        className={`${styles.infoCard} ${styles.vitalCard} ${isGenomicPlaceholder ? styles.infoCardEmpty : ''} ${isActive ? styles.vitalCardActive : ''}`}
                                                        onClick={() => setSelectedGenomicMetric(metric)}
                                                    >
                                                        <div className={styles.infoLabel}>{metric}</div>
                                                        <div className={styles.infoContent}>{formatLabDisplayValue('pathway', value)}</div>
                                                    </button>
                                                );
                                            })}

                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.vitalGridNav}
                                        onClick={() => scrollMetricGrid(genomicGridRef, 1)}
                                        aria-label="Scroll right"
                                    >
                                        <span>{'>'}</span>
                                    </button>
                                </div>
                            )}
                            {chartData ? (
                                <div className={styles.vitalChart}>
                                    <div className={styles.vitalChartHeader}>
                                        {chartTitle}
                                    </div>
                                    <div
                                        ref={chartScrollRef}
                                        className={styles.vitalChartScroll}
                                        onMouseDown={handleChartMouseDown}
                                        onMouseMove={handleChartMouseMove}
                                        onMouseUp={handleChartMouseUp}
                                        onMouseLeave={handleChartMouseLeave}
                                    >
                                        {(() => {
                                            const baseWidth = 720;
                                            const height = 160;
                                            const paddingX = 68;
                                            const paddingTop = 48;
                                            const paddingBottom = 44;
                                            const baseUsableWidth = baseWidth - paddingX * 2;
                                            const visibleCount = 10;
                                            const totalPoints = chartData.labels.length;
                                            const stepSize = totalPoints > 1
                                                ? baseUsableWidth / Math.max(1, visibleCount - 1)
                                                : 0;
                                            const width = Math.max(
                                                baseWidth,
                                                paddingX * 2 + (totalPoints - 1) * stepSize,
                                            );
                                            const usableWidth = width - paddingX * 2;
                                            const usableHeight = height - paddingTop - paddingBottom;
                                            const step = totalPoints > 1
                                                ? usableWidth / (totalPoints - 1)
                                                : 0;
                                            const pointsSpan = (totalPoints - 1) * step;
                                            const centerOffset = pointsSpan < usableWidth
                                                ? (usableWidth - pointsSpan) / 2
                                                : 0;
                                            const yTicks = vitalTab === 'lab'
                                                && (selectedLabMetric === 'child_pugh_class' || selectedLabMetric === 'albi_grade')
                                                ? [3, 2, 1]
                                                : [
                                                    chartData.maxValue,
                                                    (chartData.maxValue + chartData.minValue) / 2,
                                                    chartData.minValue,
                                                ];
                                            const normalRanges = vitalTab === 'vital'
                                                ? (selectedVitalMetric === 'bp'
                                                    ? [
                                                        { min: 90, max: 120, color: '#4C3FFF', opacity: 0.18 },
                                                        { min: 60, max: 80, color: '#B294FF', opacity: 0.08 },
                                                    ]
                                                    : selectedVitalMetric === 'hr'
                                                        ? [{ min: 60, max: 100, color: '#0EA5E9', opacity: 0.12 }]
                                                        : [{ min: 36.5, max: 37.5, color: '#F97316', opacity: 0.12 }])
                                                : vitalTab === 'lab' && chartData.normalBounds && (
                                                    chartData.normalBounds.min !== undefined || chartData.normalBounds.max !== undefined
                                                )
                                                    ? [{
                                                        min: chartData.normalBounds.min ?? chartData.minValue,
                                                        max: chartData.normalBounds.max ?? chartData.maxValue,
                                                        color: '#22C55E',
                                                        opacity: 0.12,
                                                    }]
                                                    : [];

                                            return (
                                                <svg
                                                    className={styles.vitalChartSvg}
                                                    viewBox={`0 0 ${width} ${height}`}
                                                    width={width}
                                                    height={height}
                                                    preserveAspectRatio="none"
                                                >
                                                    {normalRanges.map((range, idx) => {
                                                        const clampedMin = Math.max(range.min, chartData.minValue);
                                                        const clampedMax = Math.min(range.max, chartData.maxValue);
                                                        if (clampedMax <= clampedMin) {
                                                            return null;
                                                        }
                                                        const topRatio = (clampedMax - chartData.minValue) / (chartData.maxValue - chartData.minValue);
                                                        const bottomRatio = (clampedMin - chartData.minValue) / (chartData.maxValue - chartData.minValue);
                                                        const yTop = paddingTop + (1 - topRatio) * usableHeight;
                                                        const yBottom = paddingTop + (1 - bottomRatio) * usableHeight;
                                                        return (
                                                            <rect
                                                                key={`normal-${idx}`}
                                                                x={paddingX}
                                                                y={yTop}
                                                                width={width - paddingX * 2}
                                                                height={yBottom - yTop}
                                                                fill={range.color}
                                                                opacity={range.opacity}
                                                            />
                                                        );
                                                    })}
                                                    {yTicks.map((value, idx) => {
                                                        const ratio = (value - chartData.minValue) / (chartData.maxValue - chartData.minValue);
                                                        const y = paddingTop + (1 - ratio) * usableHeight;
                                                        return (
                                                            <g key={`y-tick-${idx}`}>
                                                                <line
                                                                    x1={paddingX}
                                                                    y1={y}
                                                                    x2={width - paddingX}
                                                                    y2={y}
                                                                    stroke="#E5E7EB"
                                                                    strokeDasharray="3 3"
                                                                />
                                                                <text
                                                                    className={styles.vitalAxisTick}
                                                                    x={paddingX - 14}
                                                                    y={y + 4}
                                                                    textAnchor="end"
                                                                >
                                                                    {vitalTab === 'lab' ? formatLabAxisTick(selectedLabMetric, value) : formatVitalNumber(value, 0)}
                                                                </text>
                                                            </g>
                                                        );
                                                    })}
                                                    {chartData.series.map((seriesItem, seriesIndex) => {
                                                        const pointList = seriesItem.values
                                                            .map((value, index) => {
                                                                if (value === null || value === undefined) {
                                                                    return null;
                                                                }
                                                                const x = paddingX + centerOffset + index * step;
                                                                const ratio = (value - chartData.minValue) / (chartData.maxValue - chartData.minValue);
                                                                const y = paddingTop + (1 - ratio) * usableHeight;
                                                                return { x, y, value };
                                                            })
                                                            .filter(Boolean) as Array<{ x: number; y: number; value: number }>;
                                                        const points = pointList.map((point) => `${point.x},${point.y}`).join(' ');
                                                        const range = vitalTab === 'vital'
                                                            ? (selectedVitalMetric === 'bp'
                                                                ? (seriesItem.label === '수축기'
                                                                    ? { min: 90, max: 120 }
                                                                    : { min: 60, max: 80 })
                                                                : selectedVitalMetric === 'hr'
                                                                    ? { min: 60, max: 100 }
                                                                    : { min: 36.5, max: 37.5 })
                                                            : vitalTab === 'lab' && chartData.normalBounds
                                                                ? { min: chartData.normalBounds.min, max: chartData.normalBounds.max }
                                                                : null;

                                                        return (
                                                            <g key={`${seriesItem.label}-${seriesIndex}`}>
                                                                <polyline
                                                                    fill="none"
                                                                    stroke={seriesItem.color}
                                                                    strokeWidth="2"
                                                                    points={points}
                                                                />
                                                                {pointList.map((point, index) => {
                                                                    const outOfRangeHigh = range && range.max !== undefined
                                                                        ? point.value > range.max
                                                                        : false;
                                                                    const outOfRangeLow = range && range.min !== undefined
                                                                        ? point.value < range.min
                                                                        : false;
                                                                    const markerColor = outOfRangeHigh
                                                                        ? '#EF4444'
                                                                        : outOfRangeLow
                                                                            ? '#0EA5E9'
                                                                            : seriesItem.color;
                                                                    return (
                                                                        <g key={`${seriesItem.label}-point-${index}`}>
                                                                            <circle
                                                                                cx={point.x}
                                                                                cy={point.y}
                                                                                r="3"
                                                                                fill={markerColor}
                                                                            />
                                                                            <text
                                                                                className={styles.vitalPointValue}
                                                                                x={point.x}
                                                                                y={point.y + (seriesIndex === 0 ? -16 : 24)}
                                                                                textAnchor="middle"
                                                                                fill={markerColor}
                                                                            >
                                                                                {vitalTab === 'lab' ? formatLabPointValue(selectedLabMetric, point.value) : formatVitalNumber(point.value, selectedVitalMetric === 'temp' ? 1 : 0)}
                                                                            </text>
                                                                        </g>
                                                                    );
                                                                })}
                                                            </g>
                                                        );
                                                    })}
                                                    {chartData.labels.map((label, index) => {
                                                        const x = paddingX + centerOffset + index * step;
                                                        return (
                                                            <text
                                                                key={`x-label-${index}`}
                                                                className={styles.vitalAxisTick}
                                                                x={x}
                                                                y={height - 4}
                                                                textAnchor="middle"
                                                            >
                                                                {label ? formatDateTime(label) : '-'}
                                                            </text>
                                                        );
                                                    })}
                                                </svg>
                                            );
                                        })()}
                                    </div>
                                    {chartData && chartData.totalPoints > chartData.labels.length && (
                                        <div className={styles.vitalRangeBar}>
                                            <span
                                                className={styles.vitalRangeThumb}
                                                style={{
                                                    width: `${Math.max(
                                                        (chartData.labels.length / chartData.totalPoints) * 100,
                                                        10,
                                                    )}%`,
                                                    left: `${(chartData.startIndex / (chartData.totalPoints - chartData.labels.length)) * (100 - Math.max(
                                                        (chartData.labels.length / chartData.totalPoints) * 100,
                                                        10,
                                                    ))}%`,
                                                }}
                                            />
                                        </div>
                                    )}
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
                                </div>
                            ) : (
                                <div className={styles.vitalChartEmpty}>
                                    {vitalTab === 'vital' && '바이탈 데이터가 없습니다.'}
                                    {vitalTab === 'lab' && '혈액검사 데이터가 없습니다.'}
                                    {vitalTab === 'genetic' && '유전체 검사 데이터가 없습니다.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
