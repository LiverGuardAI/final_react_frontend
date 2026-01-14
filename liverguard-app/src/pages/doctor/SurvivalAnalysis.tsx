import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import * as adminApi from '../../api/receptionApi';
import * as aiApi from '../../api/ai_api';
import FeatureSelectRow from '../../components/doctor/FeatureSelectRow';
import type { CtSeriesItem, GenomicDataItem, HCCDiagnosis, LabResult, PatientProfile } from '../../api/doctorApi';
import { useDoctorData } from '../../contexts/DoctorDataContext';
import { useTreatment } from '../../contexts/TreatmentContext';
import styles from './AIAnalysis.module.css';

/**
 * Task 3: Survival Analysis (간암 생존 분석)
 * - Uses CT features, clinical features, and Genomic (mRNA) data.
 */
const SurvivalAnalysis: React.FC = () => {
  const { patientId: urlPatientId } = useParams();
  const { waitingQueueData } = useDoctorData();
  const { selectedPatientId } = useTreatment();
  const inClinicPatientId = useMemo(() => {
    const queue = waitingQueueData?.queue ?? [];
    if (queue.length === 0) {
      return '';
    }
    const inClinicItem = queue.find((item: any) => item.workflow_state === 'IN_CLINIC');
    if (!inClinicItem) {
      return '';
    }
    const patientObj =
      typeof inClinicItem.patient === 'object' && inClinicItem.patient !== null
        ? inClinicItem.patient
        : null;
    return patientObj?.patient_id || inClinicItem.patient_id || '';
  }, [waitingQueueData]);
  const resolvedPatientId = selectedPatientId || inClinicPatientId || urlPatientId || '';
  // 상태 관리
  const [selectedPatient, setSelectedPatient] = useState(resolvedPatientId);
  const [selectedRadioId, setSelectedRadioId] = useState('');
  const [selectedClinicalId, setSelectedClinicalId] = useState('');
  const [selectedHccId, setSelectedHccId] = useState('');
  const [selectedGenomicId, setSelectedGenomicId] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCtSeries, setSelectedCtSeries] = useState<CtSeriesItem | null>(null);
  const [selectedLabResult, setSelectedLabResult] = useState<LabResult | null>(null);
  const [selectedGenomicData, setSelectedGenomicData] = useState<GenomicDataItem | null>(null);
  const [selectedHccDiagnosis, setSelectedHccDiagnosis] = useState<HCCDiagnosis | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  // Prediction task management
  const [taskId, setTaskId] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
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

  // 날짜 포맷팅 함수 (YYYY-MM-DD)
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  const getLabItems = (lab: LabResult | null) => [
    { label: 'AFP', value: lab?.afp },
    { label: 'ALBUMIN', value: lab?.albumin },
    { label: 'BILIRUBIN_TOTAL', value: lab?.bilirubin_total },
    { label: 'PT_INR', value: lab?.pt_inr },
    { label: 'PLATELET', value: lab?.platelet },
    { label: 'CREATININE', value: lab?.creatinine },
    { label: 'MELD_SCORE', value: lab?.meld_score },
    { label: 'ALBI_SCORE', value: lab?.albi_score },
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
    const normalizeLevel = (value: string | number | null | undefined, map?: Record<string, number>) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') {
        return value >= 1 && value <= 3 ? value : null;
      }
      const trimmed = String(value).trim().toUpperCase();
      if (map && map[trimmed]) return map[trimmed];
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) && parsed >= 1 && parsed <= 3 ? parsed : null;
    };
    const childLevel = normalizeLevel(lab.child_pugh_class, { A: 1, B: 2, C: 3 });
    const albiLevel = normalizeLevel(lab.albi_grade);
    const getRiskGradient = (level: number | null) => {
      if (!level) return 'conic-gradient(#e2e8f0 0deg, #e2e8f0 360deg)';
      if (level === 1) return 'conic-gradient(#10b981 0deg 120deg, #e2e8f0 120deg 360deg)';
      if (level === 2) return 'conic-gradient(#f59e0b 0deg 240deg, #e2e8f0 240deg 360deg)';
      return 'conic-gradient(#ef4444 0deg 360deg)';
    };
    return (
      <div className={styles.barGroup}>
        {renderBarList(getLabItems(lab))}
        <div className={styles.barSide}>
          <div className={`${styles.barBadge} ${styles.barBadgeCompact}`}>
            <div className={styles.barBadgeLabel}>CHILD</div>
            <div className={styles.riskRow}>
              <div className={styles.riskDonut} style={{ background: getRiskGradient(childLevel) }}>
                <div className={styles.riskDonutLabel}>{lab.child_pugh_class ?? '-'}</div>
              </div>
            </div>
          </div>
          <div className={`${styles.barBadge} ${styles.barBadgeCompact}`}>
            <div className={styles.barBadgeLabel}>ALBI</div>
            <div className={styles.riskRow}>
              <div className={styles.riskDonut} style={{ background: getRiskGradient(albiLevel) }}>
                <div className={styles.riskDonutLabel}>{lab.albi_grade ?? '-'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatNumber = (value: unknown, digits = 3) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toFixed(digits);
  };

  const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const getYearUnit = (timeline?: number[]) => {
    if (!timeline?.length) return null;
    const times = timeline.filter((time) => Number.isFinite(time));
    if (!times.length) return null;
    const maxTime = Math.max(...times);
    if (maxTime >= 365) return 365;
    if (maxTime >= 36) return 12;
    return 1;
  };

  const getSurvivalRateAt = (
    timeline?: number[],
    survival?: number[],
    target?: number
  ) => {
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

  const renderSurvivalRateSummary = (
    timeline?: number[],
    survival?: number[]
  ) => {
    const yearUnit = getYearUnit(timeline);
    if (!yearUnit || !timeline || !survival) {
      return <div className={styles.survivalRateEmpty}>생존률 데이터 없음</div>;
    }

    const items = [1, 2, 3].map((year) => {
      const rate = getSurvivalRateAt(timeline, survival, year * yearUnit);
      const clamped = typeof rate === 'number' ? clampValue(rate, 0, 1) : null;
      return { label: `${year}년`, value: clamped };
    });

    return (
      <div className={styles.survivalRateGrid}>
        {items.map((item) => {
          const percent = item.value === null ? null : item.value * 100;
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
    );
  };

  const getRiskTone = (group?: string) => {
    const label = (group || '').toLowerCase();
    if (label.includes('high')) return styles.riskHigh;
    if (label.includes('medium')) return styles.riskMedium;
    if (label.includes('low')) return styles.riskLow;
    return styles.riskNeutral;
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
    if (resolvedPatientId !== selectedPatient) {
      setSelectedPatient(resolvedPatientId);
    }
  }, [resolvedPatientId, selectedPatient]);

  // Poll task status
  useEffect(() => {
    if (!taskId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await aiApi.getPredictionTaskStatus(taskId);

        if (statusResponse.status === 'SUCCESS') {
          const taskResult: any = statusResponse.result;
          if (taskResult?.status === 'failed') {
            setPredictionError(taskResult.error || 'Prediction failed');
          } else {
            setPredictionResult(taskResult?.result ?? taskResult);
          }
          setIsPolling(false);
          clearInterval(pollInterval);
        } else if (statusResponse.status === 'FAILURE') {
          setPredictionError(statusResponse.error || 'Prediction failed');
          setIsPolling(false);
          clearInterval(pollInterval);
        }
        // PENDING or PROGRESS - continue polling
      } catch (error) {
        console.error('Failed to poll task status:', error);
        setPredictionError('Failed to check task status');
        setIsPolling(false);
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [taskId, isPolling]);


  const handleRunAnalysis = async () => {
    if (!selectedCtSeries || !selectedLabResult || !selectedGenomicData || !selectedHccDiagnosis || !patientProfile) {
      alert('데이터(CT, 혈액, 유전체)를 모두 선택해주세요.');
      return;
    }

    setLoading(true);
    setPredictionResult(null);
    setPredictionError(null);
    setShowAllHazards(false);

    try {
      // Build clinical array from selected data
      const clinicalData = aiApi.buildClinicalArray({
        age: patientProfile.age ?? undefined,
        gender: patientProfile.gender ?? undefined,
        grade: selectedHccDiagnosis.grade ?? undefined,
        vascularInvasion: selectedHccDiagnosis.vascular_invasion ?? undefined,
        ishakScore: selectedHccDiagnosis.ishak_score ?? undefined,
        afp: selectedLabResult.afp ?? undefined,
        albumin: selectedLabResult.albumin ?? undefined,
        bilirubinTotal: selectedLabResult.bilirubin_total ?? undefined,
        platelet: selectedLabResult.platelet ?? undefined,
        inr: selectedLabResult.pt_inr ?? undefined,
        creatinine: selectedLabResult.creatinine ?? undefined,
      });

      // Build mRNA array from selected genomic data
      const mrnaData = aiApi.buildMRNAArray(selectedGenomicData.pathway_scores);

      console.log('Clinical data array:', clinicalData);
      console.log('mRNA data array:', mrnaData);

      // Validate mRNA data
      if (mrnaData.length !== 20) {
        alert(`mRNA pathway scores must have 20 values, got ${mrnaData.length}`);
        return;
      }

      // Get series_uid from selected CT series
      const seriesUid = selectedCtSeries.series_uid;

      if (!seriesUid) {
        alert('CT Series UID가 없습니다.');
        return;
      }

      // Call survival prediction API
      const response = await aiApi.predictSurvival(clinicalData, mrnaData, seriesUid);

      console.log('Survival prediction task started:', response);
      setTaskId(response.task_id);
      setIsPolling(true);

    } catch (error: any) {
      console.error('Failed to start survival prediction:', error);
      setPredictionError(error.response?.data?.error || error.message || 'Failed to start prediction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>생존 분석 (Survival Analysis)</h1>

      {/* 데이터 선택 영역 (상단 일렬 배치) */}
      <div className={styles.selectionHeader}>
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

      {/* 선택된 데이터의 날짜 정보 표시 */}
      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>선택된 데이터 정보</div>
        <div className={styles.infoGrid}>
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
            <div className={styles.infoHeader}>
              <span className={styles.infoLabel}>CT 촬영 정보</span>
              <span className={styles.infoMeta}>{formatDate(selectedCtSeries?.study__study_datetime || selectedCtSeries?.acquisition_datetime)}</span>
            </div>
            <div className={styles.infoRow}>
              {getCtInfoItems(selectedCtSeries).map((item) => (
                <span key={item} className={styles.infoPill}>{item}</span>
              ))}
              {!getCtInfoItems(selectedCtSeries).length && <span>-</span>}
            </div>
          </div>
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
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>HCC 진단</span>
            <div className={styles.infoRow}>
              {getHccInfoItems(selectedHccDiagnosis).map((item) => (
                <span key={item} className={styles.infoPill}>{item}</span>
              ))}
              {!getHccInfoItems(selectedHccDiagnosis).length && <span>-</span>}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionArea}>
        <button className={styles.predictBtn} onClick={handleRunAnalysis}
          disabled={loading || isPolling || !selectedCtSeries || !selectedLabResult || !selectedGenomicData || !selectedHccDiagnosis || !patientProfile}>
          {isPolling ? '분석 중...' : '분석 실행'}
        </button>
      </div>
      <div className={styles.resultArea}>
        {predictionError && (
          <div style={{ color: 'red', padding: '10px', background: '#fee', borderRadius: '4px' }}>
            오류: {predictionError}
          </div>
        )}
        {predictionResult?.error && (
          <div style={{ color: 'red', padding: '10px', background: '#fee', borderRadius: '4px' }}>
            오류: {predictionResult.error}
          </div>
        )}
        {predictionResult && (
          <div className={styles.resultGrid}>
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <span className={styles.resultTitle}>생존 분석 요약</span>
                <span className={`${styles.riskBadge} ${getRiskTone(predictionResult.risk_group)}`}>
                  {predictionResult.risk_group || '-'}
                </span>
              </div>
              <p className={styles.summaryNote}>{predictionResult.warning}</p>
              {renderSurvivalRateSummary(
                predictionResult.survival_curve?.timeline,
                predictionResult.survival_curve?.survival
              )}
              <div className={styles.summaryCharts}>
                {renderLineChart(
                  '생존곡선',
                  predictionResult.survival_curve?.timeline,
                  predictionResult.survival_curve?.survival,
                  '#2563eb',
                  { legendLabel: 'Survival Probability', xLabel: 'Month', yLabel: 'Probability' }
                )}
                {renderLineChart(
                  '누적 위험도 곡선',
                  predictionResult.hazard_curve?.timeline,
                  predictionResult.hazard_curve?.hazard,
                  '#ef4444',
                  { legendLabel: 'Cumulative Hazard', xLabel: 'Month', yLabel: 'Hazard' }
                )}
              </div>
              <div className={styles.summaryHazard}>
                {renderHazardChart(Array.isArray(predictionResult.hazard_ratio) ? predictionResult.hazard_ratio : [])}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurvivalAnalysis;
