import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as aiApi from '../../api/ai_api';
import FeatureSelectRow from '../../components/doctor/FeatureSelectRow';
import type { CtSeriesItem, GenomicDataItem, HCCDiagnosis, LabResult, PatientProfile } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';
import styles from './AIAnalysis.module.css';

type TaskStatus = 'idle' | 'pending' | 'progress' | 'success' | 'failure';

interface TaskState {
  status: TaskStatus;
  result: any | null;
  message?: string;
  error?: string;
}

const createEmptyTaskState = (): TaskState => ({
  status: 'idle',
  result: null,
  message: undefined,
  error: undefined,
});

export default function AIIntegratedAnalysis() {
  const { patientId: urlPatientId } = useParams();
  const { selectedPatientId } = useTreatment();
  const resolvedPatientId = selectedPatientId || urlPatientId || '';

  const [selectedRadioId, setSelectedRadioId] = useState('');
  const [selectedClinicalId, setSelectedClinicalId] = useState('');
  const [selectedGenomicId, setSelectedGenomicId] = useState('');
  const [selectedHccId, setSelectedHccId] = useState('');
  const [selectedCtSeries, setSelectedCtSeries] = useState<CtSeriesItem | null>(null);
  const [selectedLabResult, setSelectedLabResult] = useState<LabResult | null>(null);
  const [selectedGenomicData, setSelectedGenomicData] = useState<GenomicDataItem | null>(null);
  const [selectedHccDiagnosis, setSelectedHccDiagnosis] = useState<HCCDiagnosis | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const [stageTaskId, setStageTaskId] = useState<string | null>(null);
  const [recurrenceTaskId, setRecurrenceTaskId] = useState<string | null>(null);
  const [survivalTaskId, setSurvivalTaskId] = useState<string | null>(null);
  const [stageState, setStageState] = useState<TaskState>(() => createEmptyTaskState());
  const [recurrenceState, setRecurrenceState] = useState<TaskState>(() => createEmptyTaskState());
  const [survivalState, setSurvivalState] = useState<TaskState>(() => createEmptyTaskState());
  const [showAllHazards, setShowAllHazards] = useState(false);

  const pathwayScoreLabels = [
    'Myc Targets V1',
    'G2-M Checkpoint',
    'Glycolysis',
    'Spermatogenesis',
    'mTORC1 Signaling',
    'E2F Targets',
    'Unfolded Protein Response',
    'Mitotic Spindle',
    'Bile Acid Metabolism',
    'PI3K/AKT/mTOR Signaling',
    'KRAS Signaling Dn',
    'Myc Targets V2',
    'UV Response Up',
    'Xenobiotic Metabolism',
    'Coagulation',
    'Fatty Acid Metabolism',
    'Adipogenesis',
    'Reactive Oxygen Species Pathway',
    'DNA Repair',
    'Oxidative Phosphorylation',
  ];
  const clinicalFeatureLabels = [
    'AGE',
    'SEX',
    'GRADE',
    'VASCULAR_INVASION',
    'ISHAK_FIBROSIS_SCORE',
    'AFP_AT_PROCUREMENT',
    'SERUM_ALBUMIN_PRERESECTION',
    'BILIRUBIN_TOTAL',
    'PLATELET_COUNT_PRERESECTION',
  ];
  const hazardFeatureIndexBase = 0;
  const ctPcaCount = 10;
  const ctFeatureLabels = Array.from({ length: ctPcaCount }, (_, index) => `CT PCA ${index + 1}`);
  const combinedFeatureLabels = [...clinicalFeatureLabels, ...pathwayScoreLabels, ...ctFeatureLabels];
  const normalizeFeatureKey = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const clinicalLabelMap = new Map(
    clinicalFeatureLabels.map((label) => [normalizeFeatureKey(label), label])
  );
  const mrnaLabelMap = new Map(
    pathwayScoreLabels.map((label) => [normalizeFeatureKey(label), label])
  );
  const parseIndexedFeature = (value: string, pattern: RegExp) => {
    const match = value.match(pattern);
    if (!match) return null;
    const index = Number(match[1]);
    return Number.isFinite(index) ? index : null;
  };
  const getHazardFeatureLabel = (feature?: string) => {
    if (!feature) return '-';
    const trimmed = feature.trim();
    if (!trimmed) return '-';
    const normalized = normalizeFeatureKey(trimmed);
    const mapped = clinicalLabelMap.get(normalized) || mrnaLabelMap.get(normalized);
    if (mapped) return mapped;

    const fIndex = parseIndexedFeature(normalized, /^f_?(\d+)$/);
    if (fIndex !== null) {
      const labelIndex = fIndex - hazardFeatureIndexBase;
      if (labelIndex >= 0) {
        return combinedFeatureLabels[labelIndex] ?? `Feature ${fIndex}`;
      }
    }

    const clinicalIndex = parseIndexedFeature(normalized, /^(?:clinical|clin|c)_?(\d+)$/);
    if (clinicalIndex !== null) {
      return clinicalFeatureLabels[clinicalIndex] ?? `Clinical ${clinicalIndex + 1}`;
    }
    const mrnaIndex = parseIndexedFeature(normalized, /^(?:mrna|pathway|gene|g)_?(\d+)$/);
    if (mrnaIndex !== null) {
      return pathwayScoreLabels[mrnaIndex] ?? `mRNA ${mrnaIndex + 1}`;
    }
    const ctIndex = parseIndexedFeature(normalized, /^(?:ct_pca|ctpca|ct|pca)_?(\d+)$/);
    if (ctIndex !== null) {
      return `CT PCA ${ctIndex + 1}`;
    }
    const genericIndex = parseIndexedFeature(normalized, /^(?:x|feature|var)_?(\d+)$/);
    if (genericIndex !== null) {
      return combinedFeatureLabels[genericIndex] ?? `Feature ${genericIndex + 1}`;
    }

    return trimmed.replace(/_/g, ' ');
  };
  const labRangeConfig: Record<string, { min?: number; max?: number }> = {
    afp: { max: 7 },
    albumin: { min: 3.5, max: 5.5 },
    bilirubin_total: { max: 1.2 },
    platelet: { min: 150, max: 450 },
    pt_inr: { min: 0.8, max: 1.2 },
    creatinine: { min: 0.6, max: 1.2 },
    meld_score: { max: 20 },
    albi_score: { max: -1.39 },
  };
  const labValueFormat: Record<string, { decimals: number }> = {
    afp: { decimals: 2 },
    albumin: { decimals: 2 },
    bilirubin_total: { decimals: 2 },
    platelet: { decimals: 0 },
    pt_inr: { decimals: 2 },
    creatinine: { decimals: 2 },
    meld_score: { decimals: 0 },
    albi_score: { decimals: 3 },
    albi_grade: { decimals: 0 },
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('ko-KR');
    } catch {
      return dateStr;
    }
  };

  const formatPercent = (value: unknown, digits = 1) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '-';
    return `${(num * 100).toFixed(digits)}%`;
  };

  const formatNumber = (value: unknown, digits = 2) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toFixed(digits);
  };

  const getStatusLabel = (status: TaskStatus) => {
    if (status === 'pending' || status === 'progress') return '분석 중';
    if (status === 'success') return '완료';
    if (status === 'failure') return '실패';
    return '대기';
  };

  const getStatusTone = (status: TaskStatus) => {
    if (status === 'success') return styles.riskLow;
    if (status === 'failure') return styles.riskHigh;
    if (status === 'pending' || status === 'progress') return styles.riskMedium;
    return styles.riskNeutral;
  };

  const getRiskTone = (label?: string) => {
    const normalized = (label || '').toLowerCase();
    if (normalized.includes('high')) return styles.riskHigh;
    if (normalized.includes('medium')) return styles.riskMedium;
    if (normalized.includes('low')) return styles.riskLow;
    return styles.riskNeutral;
  };

  const getStageTone = (stageCode?: number) => {
    if (stageCode === 0) return styles.riskLow;
    if (stageCode === 1) return styles.riskMedium;
    if (stageCode === 2) return styles.riskHigh;
    return styles.riskNeutral;
  };

  const getTopProbability = (probabilities?: Record<string, number>) => {
    if (!probabilities) return null;
    const entries = Object.entries(probabilities);
    if (!entries.length) return null;
    return entries.reduce(
      (acc, [label, value]) => (value > acc.value ? { label, value } : acc),
      { label: entries[0][0], value: entries[0][1] }
    );
  };

  const getStageInterpretation = (stageCode?: number) => {
    if (stageCode === 0) {
      return '조기 단계 간암으로 예측됩니다. 근치적 치료(절제술, 이식)가 가능할 수 있습니다.';
    }
    if (stageCode === 1) {
      return '중기 단계 간암으로 예측됩니다. 치료 옵션에 대한 다학제적 논의가 필요합니다.';
    }
    if (stageCode === 2) {
      return '진행성 간암으로 예측됩니다. 전신 치료 및 완화 치료를 고려해야 합니다.';
    }
    return '임상적 의미를 해석할 수 있는 정보가 부족합니다.';
  };

  const getRecurrenceLabel = (riskLevel?: string) => {
    if (!riskLevel) return '-';
    const normalized = riskLevel.toLowerCase();
    if (normalized.includes('low')) return '낮음 (Low)';
    if (normalized.includes('medium')) return '중간 (Medium)';
    if (normalized.includes('high')) return '높음 (High)';
    return riskLevel;
  };

  const getRecurrenceInterpretation = (prediction?: number, riskLevel?: string) => {
    const normalized = (riskLevel || '').toLowerCase();
    if (prediction === 0) {
      return '조기 재발 가능성이 낮습니다. 표준 추적 관찰 프로토콜을 적용할 수 있습니다.';
    }
    if (prediction === 1 && normalized.includes('medium')) {
      return '중등도 재발 위험이 있습니다. 강화된 추적 관찰 및 보조 치료를 고려해야 합니다.';
    }
    if (prediction === 1 && normalized.includes('high')) {
      return '조기 재발 가능성이 높습니다. 적극적인 보조 치료 및 집중 추적 관찰이 필요합니다.';
    }
    return '재발 위험도에 대한 추가 해석이 필요합니다.';
  };

  const getStageColor = (label: string, stageCode?: number) => {
    if (typeof stageCode === 'number') {
      if (stageCode === 0) return '#10b981';
      if (stageCode === 1) return '#f59e0b';
      return '#ef4444';
    }
    const normalized = label.toLowerCase();
    if (normalized.includes('iii') || normalized.includes('iv')) return '#ef4444';
    if (normalized.includes('ii')) return '#f59e0b';
    if (normalized.includes('i')) return '#10b981';
    return '#94a3b8';
  };

  const getStageProbabilityEntries = (probabilities?: Record<string, number>) => {
    if (!probabilities) return [];
    const order = ['Stage I', 'Stage II', 'Stage III+', 'Stage III', 'Stage IV'];
    return Object.entries(probabilities).sort((a, b) => {
      const indexA = order.indexOf(a[0]);
      const indexB = order.indexOf(b[0]);
      if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0]);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const getYearUnit = (timeline?: number[]) => {
    if (!timeline?.length) return null;
    const times = timeline.filter((time) => Number.isFinite(time));
    if (!times.length) return null;
    const maxTime = Math.max(...times);
    if (maxTime >= 365) return 365;
    if (maxTime >= 36) return 12;
    return 1;
  };

  const getSurvivalRateAt = (timeline?: number[], survival?: number[], target?: number) => {
    if (!timeline || !survival || !timeline.length || !survival.length) return null;
    if (target === null || target === undefined) return null;

    const length = Math.min(timeline.length, survival.length);
    const pairs = Array.from({ length }, (_, index) => ({
      time: timeline[index],
      value: survival[index],
    })).filter((pair) => Number.isFinite(pair.time) && Number.isFinite(pair.value));

    if (!pairs.length) return null;
    pairs.sort((a, b) => a.time - b.time);

    if (target <= pairs[0].time) return pairs[0].value;
    for (let i = 1; i < pairs.length; i += 1) {
      const current = pairs[i];
      if (target <= current.time) {
        const prev = pairs[i - 1];
        const range = current.time - prev.time;
        if (!range) return current.value;
        const ratio = (target - prev.time) / range;
        return prev.value + (current.value - prev.value) * ratio;
      }
    }
    return pairs[pairs.length - 1].value;
  };

  const getSurvivalRates = (result: any) => {
    if (!result) return [];
    if (result.survival_probabilities) {
      const probabilities = result.survival_probabilities;
      return [
        { label: '1년', value: probabilities.months_12 },
        { label: '2년', value: probabilities.months_24 },
        { label: '3년', value: probabilities.months_36 },
      ];
    }
    const timeline = result.survival_curve?.timeline;
    const survival = result.survival_curve?.survival;
    const yearUnit = getYearUnit(timeline);
    if (!yearUnit || !timeline || !survival) return [];
    return [1, 2, 3].map((year) => ({
      label: `${year}년`,
      value: getSurvivalRateAt(timeline, survival, year * yearUnit),
    }));
  };

  const renderLineChart = (
    title: string,
    timeline: number[] | undefined,
    values: number[] | undefined,
    color: string,
    options?: { legendLabel?: string; xLabel?: string; yLabel?: string }
  ) => {
    if (!timeline || !values || !timeline.length || !values.length) {
      return (
        <div className={styles.chartEmpty}>
          <span>{title}</span>
          <span>데이터 없음</span>
        </div>
      );
    }

    const length = Math.min(timeline.length, values.length);
    const xValues = timeline.slice(0, length);
    const yValues = values.slice(0, length);

    const width = 520;
    const height = 260;
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    const tickCount = 8;
    const paddingX = width / (tickCount + 2);
    const paddingY = height / (tickCount + 2);
    const xLabelDigits = xRange >= 100 ? 0 : 1;
    const yLabelDigits = yRange < 0.1 ? 3 : 2;
    const legendLabel = options?.legendLabel ?? title;
    const xAxisLabel = options?.xLabel ?? 'Time';
    const yAxisLabel = options?.yLabel ?? 'Value';
    const xTickLabelY = height - paddingY + Math.max(10, paddingY * 0.45);
    const xAxisLabelY = height - Math.max(4, paddingY * 0.15);

    const xTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
      const value = minX + (xRange * index) / tickCount;
      const x = paddingX + ((value - minX) / xRange) * (width - paddingX * 2);
      return { value, x };
    });

    const yTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
      const value = minY + (yRange * index) / tickCount;
      const y = height - paddingY - ((value - minY) / yRange) * (height - paddingY * 2);
      return { value, y };
    });
    const axisFontSize = 8;
    const axisCharWidth = axisFontSize * 0.6;
    const yTickLabels = yTicks.map((tick) => formatNumber(tick.value, yLabelDigits));
    const maxYLabelLength = yTickLabels.length
      ? Math.max(...yTickLabels.map((label) => label.length))
      : 0;
    const yTickLabelWidth = maxYLabelLength * axisCharWidth;
    const yTickLabelX = paddingX - Math.max(6, paddingX * 0.15);
    const yAxisLabelX = Math.max(6, (yTickLabelX - yTickLabelWidth) / 2);

    const points = xValues.map((x, index) => {
      const y = yValues[index];
      const px = paddingX + ((x - minX) / xRange) * (width - paddingX * 2);
      const py = height - paddingY - ((y - minY) / yRange) * (height - paddingY * 2);
      return [px, py];
    });

    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
      .join(' ');
    const lastPoint = points[points.length - 1];
    const areaPath = `${path} L ${lastPoint[0].toFixed(2)} ${(height - paddingY).toFixed(2)} L ${points[0][0].toFixed(2)} ${(height - paddingY).toFixed(2)} Z`;
    const markerStep = Math.max(1, Math.floor(points.length / 12));
    const markerPoints = points.filter((_, index) => index % markerStep === 0);
    const gradientId = `${title.replace(/\s+/g, '-').toLowerCase()}-area`;

    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>{title}</span>
        </div>
        <div className={styles.chartLegendRow}>
          <span className={styles.legendSwatch} style={{ backgroundColor: color }} />
          <span className={styles.legendLabel}>{legendLabel}</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.lineChart}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={width} height={height} rx={12} fill="#f8fafc" />
          <g>
            {yTicks.map((tick, index) => (
              <g key={`y-${index}`}>
                <line
                  x1={paddingX}
                  y1={tick.y}
                  x2={width - paddingX}
                  y2={tick.y}
                  className={styles.chartGridLine}
                />
                <text
                  x={yTickLabelX}
                  y={tick.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className={styles.chartAxisText}
                >
                  {yTickLabels[index]}
                </text>
              </g>
            ))}
            {xTicks.map((tick, index) => (
              <g key={`x-${index}`}>
                <line
                  x1={tick.x}
                  y1={paddingY}
                  x2={tick.x}
                  y2={height - paddingY}
                  className={styles.chartGridLine}
                />
                <text
                  x={tick.x}
                  y={xTickLabelY}
                  textAnchor="middle"
                  className={styles.chartAxisText}
                >
                  {formatNumber(tick.value, xLabelDigits)}
                </text>
              </g>
            ))}
          </g>
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} className={styles.chartAxisLine} />
          <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} className={styles.chartAxisLine} />
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={path} fill="none" stroke={color} strokeWidth={1.8} />
          {markerPoints.map((point, index) => (
            <circle key={`point-${index}`} cx={point[0]} cy={point[1]} r={2.6} fill={color} opacity={0.85} />
          ))}
          {lastPoint && (
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r={4} fill={color} className={styles.chartPoint} />
          )}
          <text
            x={width / 2}
            y={xAxisLabelY}
            textAnchor="middle"
            className={styles.chartAxisLabel}
          >
            {xAxisLabel}
          </text>
          <text
            x={yAxisLabelX}
            y={height / 2}
            textAnchor="middle"
            className={styles.chartAxisLabel}
            transform={`rotate(-90 ${yAxisLabelX} ${height / 2})`}
          >
            {yAxisLabel}
          </text>
        </svg>
        <div className={styles.chartLegend}>
          <span>{`Min ${formatNumber(minY, 3)}`}</span>
          <span>{`Max ${formatNumber(maxY, 3)}`}</span>
        </div>
      </div>
    );
  };

  const renderHazardChart = (rows: Array<{ feature?: string; hazard_ratio?: number; coef?: number; p_value?: number }>) => {
    const sortable = rows
      .filter((row) => Number.isFinite(row.hazard_ratio))
      .sort((a, b) => (b.hazard_ratio ?? 0) - (a.hazard_ratio ?? 0));

    if (!sortable.length) {
      return (
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>변수 위험도 (HR)</span>
            <span className={styles.chartMeta}>상위 값 기준</span>
          </div>
          <div className={styles.chartEmpty}>HR 데이터 없음</div>
        </div>
      );
    }

    const hazardRowLimit = 12;
    const isExpanded = showAllHazards;
    const displayRows = isExpanded ? sortable : sortable.slice(0, hazardRowLimit);
    const maxDelta = Math.max(
      0,
      ...displayRows.map((row) => {
        const ratio = typeof row.hazard_ratio === 'number' ? row.hazard_ratio : 1;
        return Math.abs(ratio - 1);
      })
    );
    const deltaScale = maxDelta > 0 ? maxDelta : 1;
    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>변수 위험도 (HR)</span>
          <span className={styles.chartMeta}>상위 값 기준</span>
        </div>
        <div className={styles.hazardChart}>
          {displayRows.map((row, index) => {
            const ratio = typeof row.hazard_ratio === 'number' ? row.hazard_ratio : 1;
            const delta = ratio - 1;
            const normalized = Math.max(-1, Math.min(1, delta / deltaScale));
            const span = Math.abs(normalized) * 50;
            const fillStart = normalized >= 0 ? 50 : 50 - span;
            const fillWidth = span;
            const marker = 50 + normalized * 50;
            const coefLabel = formatNumber(row.coef, 6);
            const pValueLabel = formatNumber(row.p_value, 6);
            const hazardLabel = formatNumber(row.hazard_ratio, 9);
            const featureLabel = getHazardFeatureLabel(row.feature);
            const hazardTone = normalized > 0 ? styles.hazardValueHigh : normalized < 0 ? styles.hazardValueLow : '';
            const fillTone = normalized > 0
              ? styles.hazardBarFillPositive
              : normalized < 0
                ? styles.hazardBarFillNegative
                : styles.hazardBarFillNeutral;
            return (
              <div className={styles.hazardRow} key={`${row.feature ?? 'feature'}-${index}`}>
                <div className={styles.hazardLabel}>
                  <span className={styles.hazardName}>{featureLabel}</span>
                  <span className={styles.hazardMetaLine}>{`coef ${coefLabel} · p ${pValueLabel}`}</span>
                </div>
                <div className={styles.hazardBarTrack}>
                  <span className={styles.hazardBaseline} />
                  <div
                    className={`${styles.hazardBarFill} ${fillTone}`}
                    style={{ left: `${fillStart}%`, width: `${fillWidth}%` }}
                  />
                  <span className={styles.hazardMarker} style={{ left: `${marker}%` }} />
                </div>
                <span className={`${styles.hazardValue} ${hazardTone}`}>{`HR ${hazardLabel}`}</span>
              </div>
            );
          })}
        </div>
        {sortable.length > hazardRowLimit && (
          <div className={styles.hazardFooter}>
            <span>
              {isExpanded
                ? `전체 ${sortable.length}개`
                : `상위 ${displayRows.length}개 / 전체 ${sortable.length}개`}
            </span>
            <button
              type="button"
              className={styles.hazardToggle}
              onClick={() => setShowAllHazards((prev) => !prev)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? '접기' : '펼치기'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const formatLabValue = (value: unknown, decimals = 2) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toFixed(decimals);
  };

  const isOutOfRange = (value: unknown, min?: number, max?: number) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return false;
    if (min !== undefined && num < min) return true;
    if (max !== undefined && num > max) return true;
    return false;
  };

  const getLabItems = (lab: LabResult | null) => [
    { key: 'afp', label: 'AFP', value: lab?.afp, rangeMin: labRangeConfig.afp?.min, rangeMax: labRangeConfig.afp?.max },
    { key: 'albumin', label: 'Albumin', value: lab?.albumin, rangeMin: labRangeConfig.albumin?.min, rangeMax: labRangeConfig.albumin?.max },
    { key: 'bilirubin_total', label: 'Bilirubin', value: lab?.bilirubin_total, rangeMin: labRangeConfig.bilirubin_total?.min, rangeMax: labRangeConfig.bilirubin_total?.max },
    { key: 'platelet', label: 'Platelet', value: lab?.platelet, rangeMin: labRangeConfig.platelet?.min, rangeMax: labRangeConfig.platelet?.max },
    { key: 'pt_inr', label: 'PT (INR)', value: lab?.pt_inr, rangeMin: labRangeConfig.pt_inr?.min, rangeMax: labRangeConfig.pt_inr?.max },
    { key: 'creatinine', label: 'Creatinine', value: lab?.creatinine, rangeMin: labRangeConfig.creatinine?.min, rangeMax: labRangeConfig.creatinine?.max },
    { key: 'child_pugh_class', label: 'Child-Pugh', value: lab?.child_pugh_class, rangeMin: undefined, rangeMax: undefined, hideBar: true },
    { key: 'meld_score', label: 'MELD', value: lab?.meld_score, rangeMin: labRangeConfig.meld_score?.min, rangeMax: labRangeConfig.meld_score?.max },
    { key: 'albi_score', label: 'ALBI Score', value: lab?.albi_score, rangeMin: labRangeConfig.albi_score?.min, rangeMax: labRangeConfig.albi_score?.max },
    { key: 'albi_grade', label: 'ALBI Grade', value: lab?.albi_grade, rangeMin: undefined, rangeMax: undefined },
  ];

  const getPathwayItems = (scores?: Record<string, number> | number[] | null) => {
    if (!scores) return [];
    if (Array.isArray(scores)) {
      return scores.map((value, index) => ({
        label: pathwayScoreLabels[index] || `Score ${index + 1}`,
        value,
      }));
    }
    return Object.entries(scores).map(([label, value]) => ({ label, value }));
  };

  const renderBarList = (
    items: Array<{ label: string; value: unknown }>,
    gridLayout = false
  ) => {
    const numericValues = items
      .map((item) => (typeof item.value === 'number' ? item.value : Number(item.value)))
      .filter((value) => Number.isFinite(value));
    const maxValue = numericValues.length ? Math.max(...numericValues) : 0;

    return (
      <div className={gridLayout ? styles.barListGrid : styles.barList}>
        {items.map((item) => {
          const numericValue =
            typeof item.value === 'number' ? item.value : Number(item.value);
          const hasValue = Number.isFinite(numericValue);
          const height = maxValue > 0 && hasValue ? (numericValue / maxValue) * 100 : 0;
          return (
            <div key={item.label} className={styles.barRow}>
              <span className={styles.barValue}>{hasValue ? numericValue : '-'}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ height: `${height}%` }} />
              </div>
              <span className={styles.barLabel}>{item.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLabSection = (lab: LabResult | null) => {
    if (!lab) return <span>-</span>;
    const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);
    const getScale = (value: unknown, min?: number, max?: number) => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) {
        return { height: 0, rangeStart: 0, rangeHeight: 0 };
      }
      const absValue = Math.abs(num);
      const absMin = min !== undefined ? Math.abs(min) : 0;
      const absMax = max !== undefined ? Math.abs(max) : 0;
      let displayMax = absMax || absMin || absValue || 1;
      displayMax = displayMax * 1.3;
      const height = clampPercent((absValue / displayMax) * 100);
      const start = min !== undefined ? absMin : 0;
      const end = max !== undefined ? absMax : displayMax;
      const rangeStart = clampPercent((start / displayMax) * 100);
      const rangeEnd = clampPercent((end / displayMax) * 100);
      return {
        height,
        rangeStart: Math.min(rangeStart, rangeEnd),
        rangeHeight: Math.max(rangeEnd - rangeStart, 0),
      };
    };

    return (
      <div className={styles.labCardGrid}>
        {getLabItems(lab).map((item) => {
          const decimals = labValueFormat[item.key]?.decimals ?? 2;
          const displayValue =
            typeof item.value === 'string' && item.key === 'child_pugh_class'
              ? item.value
              : typeof item.value === 'string' && item.key === 'albi_grade'
                ? item.value
                : formatLabValue(item.value, decimals);
          const outOfRange = isOutOfRange(item.value, item.rangeMin, item.rangeMax);
          const barColor = outOfRange ? '#ef4444' : '#10b981';
          const scale = getScale(item.value, item.rangeMin, item.rangeMax);
          const showBar = !item.hideBar && displayValue !== '-';
          const showRange =
            item.rangeMin !== undefined || item.rangeMax !== undefined;

          return (
            <div key={item.key} className={styles.labCard}>
              <div className={styles.labCardLabel}>{item.label}</div>
              <div className={styles.labCardChart}>
                {showRange && (
                  <div
                    className={styles.labCardRange}
                    style={{ bottom: `${scale.rangeStart}%`, height: `${scale.rangeHeight}%` }}
                  />
                )}
                {showBar && (
                  <div
                    className={styles.labCardBar}
                    style={{ height: `${scale.height}%`, background: barColor }}
                  />
                )}
              </div>
              <div
                className={`${styles.labCardValue} ${
                  displayValue === '-' ? styles.labCardValueMuted : outOfRange ? styles.labCardValueAlert : styles.labCardValueOk
                }`}
              >
                {displayValue}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getPatientInfoItems = (profile: PatientProfile | null) => {
    if (!profile) return [];
    return [
      `나이 ${profile.age ?? '-'}`,
      `성별 ${profile.gender ?? '-'}`,
      `키 ${profile.height ?? '-'}`,
      `체중 ${profile.weight ?? '-'}`,
    ];
  };

  const getCtInfoItems = (series: CtSeriesItem | null) => {
    if (!series) return [];
    return [
      `Protocol: ${series.protocol_name ?? '-'}`,
      `Images: ${series.image_count ?? '-'}`,
      `Slice Thickness: ${series.slice_thickness ?? '-'}`,
      `Pixel Spacing: ${series.pixel_spacing ?? '-'}`,
    ];
  };

  const getHccInfoItems = (diagnosis: HCCDiagnosis | null) => {
    if (!diagnosis) return [];
    return [
      `Stage ${diagnosis.ajcc_stage ?? '-'}`,
      `Grade ${diagnosis.grade ?? '-'}`,
      `VI ${diagnosis.vascular_invasion ?? '-'}`,
      `Ishak ${diagnosis.ishak_score ?? '-'}`,
    ];
  };

  useEffect(() => {
    setSelectedRadioId('');
    setSelectedClinicalId('');
    setSelectedGenomicId('');
    setSelectedHccId('');
    setSelectedCtSeries(null);
    setSelectedLabResult(null);
    setSelectedGenomicData(null);
    setSelectedHccDiagnosis(null);
    setPatientProfile(null);
    setStageTaskId(null);
    setRecurrenceTaskId(null);
    setSurvivalTaskId(null);
    setStageState(createEmptyTaskState());
    setRecurrenceState(createEmptyTaskState());
    setSurvivalState(createEmptyTaskState());
    setShowAllHazards(false);
  }, [resolvedPatientId]);

  const hasBaseData =
    Boolean(selectedCtSeries) &&
    Boolean(selectedLabResult) &&
    Boolean(selectedHccDiagnosis) &&
    Boolean(patientProfile);

  const hasGenomicData = Boolean(selectedGenomicData);
  const hasPendingTask = [stageState.status, recurrenceState.status, survivalState.status].some(
    (status) => status === 'pending' || status === 'progress'
  );

  const handleRunAnalysis = async () => {
    if (!hasBaseData) {
      alert('CT, 혈액, HCC, 환자 정보가 모두 필요합니다.');
      return;
    }

    const seriesUid = selectedCtSeries?.series_uid;
    if (!seriesUid) {
      alert('CT Series UID가 없습니다.');
      return;
    }

    setLoading(true);
    setStageState({ status: 'pending', result: null, message: undefined, error: undefined });
    setRecurrenceState({ status: 'idle', result: null, message: undefined, error: undefined });
    setSurvivalState({ status: 'idle', result: null, message: undefined, error: undefined });
    setStageTaskId(null);
    setRecurrenceTaskId(null);
    setSurvivalTaskId(null);
    setShowAllHazards(false);

    const clinicalData = aiApi.buildClinicalArray({
      age: patientProfile?.age ?? undefined,
      gender: patientProfile?.gender ?? undefined,
      grade: selectedHccDiagnosis?.grade ?? undefined,
      vascularInvasion: selectedHccDiagnosis?.vascular_invasion ?? undefined,
      ishakScore: selectedHccDiagnosis?.ishak_score ?? undefined,
      afp: selectedLabResult?.afp ?? undefined,
      albumin: selectedLabResult?.albumin ?? undefined,
      bilirubinTotal: selectedLabResult?.bilirubin_total ?? undefined,
      platelet: selectedLabResult?.platelet ?? undefined,
      inr: selectedLabResult?.pt_inr ?? undefined,
      creatinine: selectedLabResult?.creatinine ?? undefined,
    });

    try {
      const stageResponse = await aiApi.predictStage(clinicalData, seriesUid);
      setStageTaskId(stageResponse.task_id);
      setStageState({ status: 'pending', result: null, message: stageResponse.message, error: undefined });
    } catch (error: any) {
      setStageState({
        status: 'failure',
        result: null,
        message: undefined,
        error: error?.response?.data?.error || error?.message || '병기 예측 요청 실패',
      });
    }

    if (selectedGenomicData) {
      const mrnaData = aiApi.buildMRNAArray(selectedGenomicData.pathway_scores);
      if (mrnaData.length !== 20) {
        const errorMessage = `mRNA pathway scores must have 20 values, got ${mrnaData.length}`;
        setRecurrenceState({ status: 'failure', result: null, message: undefined, error: errorMessage });
        setSurvivalState({ status: 'failure', result: null, message: undefined, error: errorMessage });
        setLoading(false);
        return;
      }

      try {
        const relapseResponse = await aiApi.predictRelapse(clinicalData, mrnaData, seriesUid);
        setRecurrenceTaskId(relapseResponse.task_id);
        setRecurrenceState({ status: 'pending', result: null, message: relapseResponse.message, error: undefined });
      } catch (error: any) {
        setRecurrenceState({
          status: 'failure',
          result: null,
          message: undefined,
          error: error?.response?.data?.error || error?.message || '조기 재발 예측 요청 실패',
        });
      }

      try {
        const survivalResponse = await aiApi.predictSurvival(clinicalData, mrnaData, seriesUid);
        setSurvivalTaskId(survivalResponse.task_id);
        setSurvivalState({ status: 'pending', result: null, message: survivalResponse.message, error: undefined });
      } catch (error: any) {
        setSurvivalState({
          status: 'failure',
          result: null,
          message: undefined,
          error: error?.response?.data?.error || error?.message || '생존 분석 요청 실패',
        });
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!hasPendingTask) return;

    const pollTask = async (
      taskId: string | null,
      status: TaskStatus,
      setTaskState: React.Dispatch<React.SetStateAction<TaskState>>
    ) => {
      if (!taskId) return;
      if (status !== 'pending' && status !== 'progress') return;

      try {
        const statusResponse = await aiApi.getPredictionTaskStatus(taskId);
        if (statusResponse.status === 'SUCCESS') {
          const payload: any = statusResponse.result;
          if (payload?.status === 'failed') {
            setTaskState((prev) => ({
              ...prev,
              status: 'failure',
              error: payload?.error || payload?.message || 'Prediction failed',
            }));
          } else {
            setTaskState({
              status: 'success',
              result: payload?.result ?? payload,
              message: payload?.message ?? statusResponse.message,
              error: undefined,
            });
          }
        } else if (statusResponse.status === 'FAILURE') {
          setTaskState((prev) => ({
            ...prev,
            status: 'failure',
            error: statusResponse.error || 'Prediction failed',
          }));
        } else {
          setTaskState((prev) => (prev.status === 'progress' ? prev : { ...prev, status: 'progress' }));
        }
      } catch (error) {
        setTaskState((prev) => ({
          ...prev,
          status: 'failure',
          error: 'Failed to check task status',
        }));
      }
    };

    const interval = setInterval(() => {
      pollTask(stageTaskId, stageState.status, setStageState);
      pollTask(recurrenceTaskId, recurrenceState.status, setRecurrenceState);
      pollTask(survivalTaskId, survivalState.status, setSurvivalState);
    }, 2000);

    return () => clearInterval(interval);
  }, [
    hasPendingTask,
    stageTaskId,
    recurrenceTaskId,
    survivalTaskId,
    stageState.status,
    recurrenceState.status,
    survivalState.status,
  ]);

  const stageResult = stageState.result;
  const recurrenceResult = recurrenceState.result;
  const survivalResult = survivalState.result;
  const stageTopProbability = getTopProbability(stageResult?.probabilities);
  const stageProbabilityEntries = getStageProbabilityEntries(stageResult?.probabilities);
  const stageInterpretation = getStageInterpretation(stageResult?.stage_code);
  const recurrenceLabel = getRecurrenceLabel(recurrenceResult?.risk_level);
  const recurrenceInterpretation = getRecurrenceInterpretation(
    recurrenceResult?.prediction,
    recurrenceResult?.risk_level
  );
  const survivalRates = getSurvivalRates(survivalResult);

  const stageMeta = stageResult
    ? [
        stageResult.model_version ? `모델 ${stageResult.model_version}` : null,
        stageResult.prediction_timestamp ? formatDateTime(stageResult.prediction_timestamp) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const recurrenceMeta = recurrenceResult
    ? [
        recurrenceResult.model_version ? `모델 ${recurrenceResult.model_version}` : null,
        recurrenceResult.prediction_timestamp ? formatDateTime(recurrenceResult.prediction_timestamp) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const survivalMeta = survivalResult
    ? [
        survivalResult.model_version ? `모델 ${survivalResult.model_version}` : null,
        survivalResult.prediction_timestamp ? formatDateTime(survivalResult.prediction_timestamp) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const stagePlaceholder = hasBaseData
    ? '분석 실행 후 결과가 표시됩니다.'
    : 'CT/혈액/HCC/환자 정보를 먼저 선택해주세요.';
  const recurrencePlaceholder = !hasGenomicData
    ? '유전체 데이터 선택 후 분석을 실행하세요.'
    : '분석 실행 후 결과가 표시됩니다.';
  const survivalPlaceholder = !hasGenomicData
    ? '유전체 데이터 선택 후 분석을 실행하세요.'
    : '분석 실행 후 결과가 표시됩니다.';

  return (
    <div className={styles.container}>

      <div className={styles.selectionHeader}>
        <div className={styles.selectionContent}>
          <FeatureSelectRow
            radioList={[]}
            clinicalList={[]}
            genomicList={[]}
            selectedRadioId={selectedRadioId}
            selectedClinicalId={selectedClinicalId}
            selectedGenomicId={selectedGenomicId}
            selectedHccId={selectedHccId}
            onRadioChange={setSelectedRadioId}
            onClinicalChange={setSelectedClinicalId}
            onGenomicChange={setSelectedGenomicId}
            onHccChange={setSelectedHccId}
            onCtSeriesSelect={setSelectedCtSeries}
            onPatientProfileSelect={setPatientProfile}
            onLabResultSelect={setSelectedLabResult}
            onGenomicDataSelect={setSelectedGenomicData}
            onHccDiagnosisSelect={setSelectedHccDiagnosis}
            formatDate={formatDate}
          />
        </div>
        <div className={styles.selectionActions}>
          <button
            className={styles.predictBtn}
            onClick={handleRunAnalysis}
            disabled={loading || hasPendingTask || !hasBaseData}
          >
            {hasPendingTask ? '분석 중...' : '분석 실행'}
          </button>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.infoGrid}>
          <div className={styles.infoRowGridThree}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>환자 정보</span>
              <div className={styles.infoRow}>
                {getPatientInfoItems(patientProfile).map((item) => (
                  <span key={item} className={styles.infoPill}>{item}</span>
                ))}
                {!getPatientInfoItems(patientProfile).length && <span>-</span>}
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>HCC 진단</span>
              <div className={styles.infoRow}>
                {getHccInfoItems(selectedHccDiagnosis).map((item) => (
                  <span key={item} className={styles.infoPill}>{item}</span>
                ))}
                {!getHccInfoItems(selectedHccDiagnosis).length && <span>-</span>}
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoHeader}>
                <span className={styles.infoLabel}>CT 촬영 정보</span>
                <span className={styles.infoMeta}>
                  {formatDate(selectedCtSeries?.study__study_datetime || selectedCtSeries?.acquisition_datetime)}
                </span>
              </div>
              <div className={styles.infoRow}>
                {getCtInfoItems(selectedCtSeries).map((item) => (
                  <span key={item} className={styles.infoPill}>{item}</span>
                ))}
                {!getCtInfoItems(selectedCtSeries).length && <span>-</span>}
              </div>
            </div>
          </div>
          <div className={styles.infoRowGridTwo}>
            <div className={`${styles.infoItem} ${styles.infoItemTall}`}>
              <div className={styles.infoHeader}>
                <span className={styles.infoLabel}>혈액 검사</span>
                <span className={styles.infoMeta}>{formatDate(selectedLabResult?.test_date)}</span>
              </div>
              {renderLabSection(selectedLabResult)}
            </div>
            <div className={`${styles.infoItem} ${styles.infoItemTall} ${styles.scrollCard}`}>
              <div className={styles.infoHeader}>
                <span className={styles.infoLabel}>유전체 검사</span>
                <span className={styles.infoMeta}>{formatDate(selectedGenomicData?.sample_date)}</span>
              </div>
              {selectedGenomicData?.pathway_scores
                ? renderBarList(getPathwayItems(selectedGenomicData.pathway_scores), true)
                : <span>-</span>}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.resultArea}>
        <div className={styles.integratedResultsGrid}>
          <div className={`${styles.resultCard} ${styles.integratedResultCard}`}>
            <div className={styles.resultHeader}>
              <div className={styles.resultHeaderText}>
                <div className={styles.resultTitle}>병기 예측</div>
                <div className={styles.resultSubtitle}>CT · 임상</div>
              </div>
              <span className={`${styles.statusBadge} ${getStatusTone(stageState.status)}`}>
                {getStatusLabel(stageState.status)}
              </span>
            </div>
            {stageState.error && (
              <div className={styles.resultNotice}>오류: {stageState.error}</div>
            )}
            {stageResult ? (
              <>
                <div className={styles.stageSummary}>
                  <span className={styles.stageSummaryLabel}>AI 예측 병기</span>
                  <span
                    className={styles.stageSummaryValue}
                    style={{ color: getStageColor(stageResult.predicted_stage ?? '', stageResult.stage_code) }}
                  >
                    {stageResult.predicted_stage ?? '-'}
                  </span>
                  <div className={styles.stageSummaryMeta}>
                    <span>최대 확률 {stageTopProbability ? formatPercent(stageTopProbability.value) : '-'}</span>
                    <span>신뢰도 {formatPercent(stageResult.confidence)}</span>
                  </div>
                </div>
                <div className={styles.stageCallout}>
                  <div className={styles.stageCalloutTitle}>임상적 의미</div>
                  <div className={styles.stageCalloutText}>{stageInterpretation}</div>
                </div>
                <div className={styles.stageDistribution}>
                  <div className={styles.stageDistributionTitle}>병기별 확률 분포</div>
                  <div className={styles.stageDistributionList}>
                    {stageProbabilityEntries.map(([label, value]) => (
                      <div key={label} className={styles.stageDistributionRow}>
                        <span className={styles.stageDistributionLabel}>{label}</span>
                        <div className={styles.stageDistributionTrack}>
                          <div
                            className={styles.stageDistributionFill}
                            style={{
                              width: `${Math.min(Math.max(value * 100, 0), 100)}%`,
                              background: getStageColor(label),
                            }}
                          />
                        </div>
                        <span className={styles.stageDistributionValue}>
                          {(value * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {(stageState.message || stageMeta) && (
                  <p className={styles.resultFooter}>
                    {[stageState.message, stageMeta].filter(Boolean).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <div className={styles.resultPlaceholder}>
                {stageState.status === 'pending' || stageState.status === 'progress'
                  ? '분석 중입니다...'
                  : stagePlaceholder}
              </div>
            )}
          </div>

          <div className={`${styles.resultCard} ${styles.integratedResultCard}`}>
            <div className={styles.resultHeader}>
              <div className={styles.resultHeaderText}>
                <div className={styles.resultTitle}>조기 재발 예측</div>
                <div className={styles.resultSubtitle}>CT · 임상 · 유전체</div>
              </div>
              <span className={`${styles.statusBadge} ${getStatusTone(recurrenceState.status)}`}>
                {getStatusLabel(recurrenceState.status)}
              </span>
            </div>
            {recurrenceState.error && (
              <div className={styles.resultNotice}>오류: {recurrenceState.error}</div>
            )}
            {recurrenceResult ? (
              <>
                <div className={styles.recurrenceSummary}>
                  <span className={styles.recurrenceSummaryLabel}>AI 예측 재발 위험도</span>
                  <span
                    className={styles.recurrenceSummaryValue}
                    style={{ color: getRiskTone(recurrenceResult.risk_level) === styles.riskHigh ? '#ef4444' : getRiskTone(recurrenceResult.risk_level) === styles.riskMedium ? '#f59e0b' : '#10b981' }}
                  >
                    {recurrenceLabel}
                  </span>
                </div>
                <div className={styles.recurrenceCallout}>
                  <div className={styles.recurrenceCalloutTitle}>임상적 의미</div>
                  <div className={styles.recurrenceCalloutText}>{recurrenceInterpretation}</div>
                </div>
                <div className={styles.recurrenceBarSection}>
                  <div className={styles.recurrenceBarHeader}>
                    <span className={styles.recurrenceBarLabel}>재발 확률</span>
                    <span className={styles.recurrenceBarValue}>
                      {formatPercent(recurrenceResult.relapse_probability)}
                    </span>
                  </div>
                  <div className={styles.recurrenceBarTrack}>
                    <div
                      className={styles.recurrenceBarFill}
                      style={{
                        width: `${Math.min(Math.max(recurrenceResult.relapse_probability * 100, 0), 100)}%`,
                        background:
                          (recurrenceResult.risk_level || '').toLowerCase().includes('high')
                            ? '#ef4444'
                            : (recurrenceResult.risk_level || '').toLowerCase().includes('medium')
                              ? '#f59e0b'
                              : '#10b981'
                      }}
                    />
                    <div
                      className={styles.recurrenceThreshold}
                      style={{ left: `${Math.min(Math.max(recurrenceResult.threshold_used * 100, 0), 100)}%` }}
                    >
                      <div className={styles.recurrenceThresholdLine} />
                      <div className={styles.recurrenceThresholdLabel}>
                        임계값<br />
                        {(recurrenceResult.threshold_used * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className={styles.recurrenceScale}>
                    <span className={styles.recurrenceScaleItem}>
                      <span className={styles.recurrenceScaleDot} style={{ background: '#10b981' }} />
                      낮음
                    </span>
                    <span className={styles.recurrenceScaleItem}>
                      <span className={styles.recurrenceScaleDot} style={{ background: '#f59e0b' }} />
                      중간
                    </span>
                    <span className={styles.recurrenceScaleItem}>
                      <span className={styles.recurrenceScaleDot} style={{ background: '#ef4444' }} />
                      높음
                    </span>
                  </div>
                </div>
                <div
                  className={`${styles.recurrenceResultBadge} ${
                    recurrenceResult.prediction === 1 ? styles.recurrenceResultAlert : styles.recurrenceResultOk
                  }`}
                >
                  예측 결과: {recurrenceResult.prediction === 1 ? '조기 재발 가능성 있음' : '조기 재발 가능성 낮음'}
                </div>
                {(recurrenceState.message || recurrenceMeta) && (
                  <p className={styles.resultFooter}>
                    {[recurrenceState.message, recurrenceMeta].filter(Boolean).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <div className={styles.resultPlaceholder}>
                {recurrenceState.status === 'pending' || recurrenceState.status === 'progress'
                  ? '분석 중입니다...'
                  : recurrencePlaceholder}
              </div>
            )}
          </div>

          <div className={`${styles.resultCard} ${styles.integratedResultCard}`}>
            <div className={styles.resultHeader}>
              <div className={styles.resultHeaderText}>
                <div className={styles.resultTitle}>생존 분석</div>
                <div className={styles.resultSubtitle}>CT · 임상 · 유전체</div>
              </div>
              <span className={`${styles.statusBadge} ${getStatusTone(survivalState.status)}`}>
                {getStatusLabel(survivalState.status)}
              </span>
            </div>
            {survivalState.error && (
              <div className={styles.resultNotice}>오류: {survivalState.error}</div>
            )}
            {survivalResult ? (
              <>
                <div className={styles.survivalSummaryGrid}>
                  <div className={styles.survivalSummaryCard}>
                    <span className={styles.survivalSummaryLabel}>위험군</span>
                    <span className={`${styles.summaryBadge} ${getRiskTone(survivalResult.risk_group)}`}>
                      {survivalResult.risk_group ?? '-'}
                    </span>
                  </div>
                  <div className={styles.survivalSummaryCard}>
                    <span className={styles.survivalSummaryLabel}>위험 점수</span>
                    <span className={styles.survivalSummaryValue}>
                      {formatNumber(survivalResult.risk_score)}
                    </span>
                  </div>
                </div>
                {survivalRates.length ? (
                  <div className={`${styles.survivalRateGrid} ${styles.survivalRateRow}`}>
                    {survivalRates.map((item) => {
                      const percent = typeof item.value === 'number' ? item.value * 100 : null;
                      return (
                        <div key={item.label} className={styles.survivalRateCard}>
                          <span className={styles.survivalRateLabel}>{item.label} 생존률</span>
                          <span className={styles.survivalRateValue}>
                            {percent === null ? '-' : `${percent.toFixed(1)}%`}
                          </span>
                          <div className={styles.survivalRateBar}>
                            <div
                              className={styles.survivalRateFill}
                              style={{ width: `${percent === null ? 0 : percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.survivalRateEmpty}>생존률 데이터 없음</div>
                )}
                <div className={styles.summaryCharts}>
                  {renderLineChart(
                    '생존곡선',
                    survivalResult.survival_curve?.timeline,
                    survivalResult.survival_curve?.survival,
                    '#2563eb',
                    { legendLabel: 'Survival Probability', xLabel: 'Month', yLabel: 'Probability' }
                  )}
                  {renderLineChart(
                    '누적 위험도 곡선',
                    survivalResult.hazard_curve?.timeline,
                    survivalResult.hazard_curve?.hazard,
                    '#ef4444',
                    { legendLabel: 'Cumulative Hazard', xLabel: 'Month', yLabel: 'Hazard' }
                  )}
                </div>
                <div className={styles.summaryHazard}>
                  {renderHazardChart(Array.isArray(survivalResult.hazard_ratio) ? survivalResult.hazard_ratio : [])}
                </div>
                {(survivalState.message || survivalMeta) && (
                  <p className={styles.resultFooter}>
                    {[survivalState.message, survivalMeta].filter(Boolean).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <div className={styles.resultPlaceholder}>
                {survivalState.status === 'pending' || survivalState.status === 'progress'
                  ? '분석 중입니다...'
                  : survivalPlaceholder}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
