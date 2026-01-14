import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import * as aiApi from '../../api/ai_api';
import FeatureSelectRow from '../../components/doctor/FeatureSelectRow';
import type { CtSeriesItem, HCCDiagnosis, LabResult, PatientProfile } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';
import styles from './AIAnalysis.module.css';

/**
 * Task 1: Staging Prediction (간암 병기예측)
 * - Uses CT features and clinical features.
 * - Genomic data is NOT required for this task.
 */

const StagePrediction: React.FC = () => {
  const { patientId: urlPatientId } = useParams();
  const { selectedPatientId } = useTreatment();
  const resolvedPatientId = selectedPatientId || urlPatientId || '';
  // 상태 관리
  const [selectedPatient, setSelectedPatient] = useState(resolvedPatientId);
  const [selectedRadioId, setSelectedRadioId] = useState('');
  const [selectedClinicalId, setSelectedClinicalId] = useState('');
  const [selectedHccId, setSelectedHccId] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCtSeries, setSelectedCtSeries] = useState<CtSeriesItem | null>(null);
  const [selectedLabResult, setSelectedLabResult] = useState<LabResult | null>(null);
  const [selectedHccDiagnosis, setSelectedHccDiagnosis] = useState<HCCDiagnosis | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  // Prediction task management
  const [taskId, setTaskId] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

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

  const renderBarList = (items: Array<{ label: string; value: unknown }>) => {
    const numericValues = items
      .map((item) => (typeof item.value === 'number' ? item.value : Number(item.value)))
      .filter((value) => Number.isFinite(value));
    const maxValue = numericValues.length ? Math.max(...numericValues) : 0;

    return (
      <div className={styles.barList}>
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

  useEffect(() => {
    if (selectedPatientId !== null) {
      return;
    }
    setSelectedRadioId('');
    setSelectedClinicalId('');
    setSelectedHccId('');
    setSelectedCtSeries(null);
    setSelectedLabResult(null);
    setSelectedHccDiagnosis(null);
    setPatientProfile(null);
    setPredictionResult(null);
    setPredictionError(null);
    setTaskId(null);
    setIsPolling(false);
  }, [selectedPatientId]);


  // Poll task status
  useEffect(() => {
    if (!taskId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await aiApi.getPredictionTaskStatus(taskId);

        if (statusResponse.status === 'SUCCESS') {
          setPredictionResult(statusResponse.result);
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
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [taskId, isPolling]);

  const handleRunAnalysis = async () => {
    if (!selectedCtSeries || !selectedLabResult || !selectedHccDiagnosis || !patientProfile) {
      alert('데이터를 모두 선택해주세요.');
      return;
    }

    setLoading(true);
    setPredictionResult(null);
    setPredictionError(null);

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

      console.log('Clinical data array:', clinicalData);

      // Get series_uid from selected CT series
      const seriesUid = selectedCtSeries.series_uid;

      if (!seriesUid) {
        alert('CT Series UID가 없습니다.');
        return;
      }

      // Call stage prediction API
      const response = await aiApi.predictStage(clinicalData, seriesUid);

      console.log('Stage prediction task started:', response);
      setTaskId(response.task_id);
      setIsPolling(true);

    } catch (error: any) {
      console.error('Failed to start stage prediction:', error);
      setPredictionError(error.response?.data?.error || error.message || 'Failed to start prediction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>병기 예측 분석 (Staging)</h1>

      {/* 데이터 선택 영역 (상단 일렬 배치) */}
      <div className={styles.selectionHeader}>
        <FeatureSelectRow
          radioList={[]}
          clinicalList={[]}
          selectedRadioId={selectedRadioId}
          selectedClinicalId={selectedClinicalId}
          selectedHccId={selectedHccId}
          onRadioChange={setSelectedRadioId}
          onClinicalChange={setSelectedClinicalId}
          onHccChange={setSelectedHccId}
          onCtSeriesSelect={setSelectedCtSeries}
          onPatientProfileSelect={setPatientProfile}
          onLabResultSelect={setSelectedLabResult}
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
          disabled={loading || isPolling || !selectedCtSeries || !selectedLabResult || !selectedHccDiagnosis || !patientProfile}>
          {isPolling ? '분석 중...' : '분석 실행'}
        </button>
      </div>
      <div className={styles.resultArea}>
        {predictionError && (
          <div style={{ color: 'red', padding: '10px', background: '#fee', borderRadius: '4px' }}>
            오류: {predictionError}
          </div>
        )}
        {predictionResult && predictionResult.result && (
          <div className={styles.predictionResult}>
            <h3 className={styles.resultTitle}>병기 예측 결과</h3>

            {/* Main Prediction Card */}
            <div className={styles.mainResultCard}>
              <div className={styles.predictedStageLabel}>AI 예측 병기</div>
              <div className={styles.predictedStageValue} style={{
                color: predictionResult.result.stage_code === 0 ? '#10b981' :
                       predictionResult.result.stage_code === 1 ? '#f59e0b' : '#ef4444'
              }}>
                {predictionResult.result.predicted_stage}
              </div>

              <div className={styles.clinicalInterpretation}>
                {predictionResult.result.stage_code === 0 && (
                  <>
                    <div className={styles.interpretationTitle}>임상적 의미</div>
                    <div className={styles.interpretationText}>
                      조기 단계 간암으로 예측됩니다. 근치적 치료(절제술, 이식)가 가능할 수 있습니다.
                    </div>
                  </>
                )}
                {predictionResult.result.stage_code === 1 && (
                  <>
                    <div className={styles.interpretationTitle}>임상적 의미</div>
                    <div className={styles.interpretationText}>
                      중기 단계 간암으로 예측됩니다. 치료 옵션에 대한 다학제적 논의가 필요합니다.
                    </div>
                  </>
                )}
                {predictionResult.result.stage_code === 2 && (
                  <>
                    <div className={styles.interpretationTitle}>임상적 의미</div>
                    <div className={styles.interpretationText}>
                      진행성 간암으로 예측됩니다. 전신 치료 및 완화 치료를 고려해야 합니다.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Probability Distribution */}
            <div className={styles.probabilitySection}>
              <h4 className={styles.sectionTitle}>병기별 확률 분포</h4>
              <div className={styles.probabilityBars}>
                {Object.entries(predictionResult.result.probabilities).map(([stage, prob]: [string, any]) => {
                  const probability = typeof prob === 'number' ? prob : 0;
                  const isStage1 = stage === 'Stage I';
                  const isStage2 = stage === 'Stage II';
                  const isStage3 = stage.includes('Stage III');
                  const barColor = isStage1 ? '#10b981' : isStage2 ? '#f59e0b' : '#ef4444';

                  return (
                    <div key={stage} className={styles.probabilityBarRow}>
                      <span className={styles.probabilityStageLabel}>{stage}</span>
                      <div className={styles.probabilityBarContainer}>
                        <div
                          className={styles.probabilityBarFill}
                          style={{
                            width: `${probability * 100}%`,
                            background: barColor
                          }}
                        />
                      </div>
                      <span className={styles.probabilityValue}>
                        {(probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Additional Info */}
            <div className={styles.additionalInfo}>
              <div className={styles.infoChip}>
                <span className={styles.infoChipLabel}>mRNA 사용:</span>
                <span className={styles.infoChipValue}>
                  {predictionResult.result.uses_mrna ? '사용' : '미사용'}
                </span>
              </div>
              <div className={styles.infoChip}>
                <span className={styles.infoChipLabel}>모델 버전:</span>
                <span className={styles.infoChipValue}>
                  {predictionResult.result.model_version}
                </span>
              </div>
              <div className={styles.infoChip}>
                <span className={styles.infoChipLabel}>예측 시간:</span>
                <span className={styles.infoChipValue}>
                  {new Date(predictionResult.result.prediction_timestamp).toLocaleString('ko-KR')}
                </span>
              </div>
              <div className={styles.infoChip}>
                <span className={styles.infoChipLabel}>분석 상태:</span>
                <span className={styles.infoChipValue} style={{ color: '#10b981' }}>
                  {predictionResult.message}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default StagePrediction;
