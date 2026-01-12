import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '../../api/predictionApi';
import * as adminApi from '../../api/administration_api';
import FeatureSelectRow from '../../components/doctor/FeatureSelectRow';
import type { CtSeriesItem, HCCDiagnosis, LabResult, PatientProfile } from '../../api/doctorApi';
import styles from './AIAnalysis.module.css';

/**
 * Task 1: Staging Prediction (간암 병기예측)
 * - Uses CT features and clinical features.
 * - Genomic data is NOT required for this task.
 */

const StagePrediction: React.FC = () => {
  const { patientId: urlPatientId } = useParams();
  // 상태 관리
  const [selectedPatient, setSelectedPatient] = useState(urlPatientId || '');
  const [radioList, setRadioList] = useState<api.RadioFeature[]>([]);
  const [clinicalList, setClinicalList] = useState<api.ClinicalFeature[]>([]);

  const [selectedRadioId, setSelectedRadioId] = useState('');
  const [selectedClinicalId, setSelectedClinicalId] = useState('');
  const [selectedHccId, setSelectedHccId] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCtSeries, setSelectedCtSeries] = useState<CtSeriesItem | null>(null);
  const [selectedLabResult, setSelectedLabResult] = useState<LabResult | null>(null);
  const [selectedHccDiagnosis, setSelectedHccDiagnosis] = useState<HCCDiagnosis | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

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

  // 1. 전체 환자 목록 로드
  // 2. 선택된 환자의 특징 데이터 로드
  useEffect(() => {
    const loadFeatures = async () => {
      if (selectedPatient) {
        setLoading(true);
        try {
          const [radio, clinical] = await Promise.all([
            api.fetchRadioFeatures(selectedPatient),
            api.fetchClinicalFeatures(selectedPatient)
          ]);
          setRadioList(radio);
          setClinicalList(clinical);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
      }
    };
    loadFeatures();
  }, [selectedPatient]);


  const handleRunAnalysis = () => {
    if (!selectedRadioId || !selectedClinicalId) {
      alert('데이터를 모두 선택해주세요.');
      return;
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>병기 예측 분석 (Staging)</h1>

      {/* 데이터 선택 영역 (상단 일렬 배치) */}
      <div className={styles.selectionHeader}>
        <FeatureSelectRow
          radioList={radioList}
          clinicalList={clinicalList}
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
              <span className={styles.infoMeta}>{formatDate(selectedLabResult?.test_date || clinicalList.find(c => c.clinical_vector_id === selectedClinicalId)?.lab_date)}</span>
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
          disabled={!selectedRadioId || !selectedClinicalId}>
          분석 실행
        </button>
      </div>
      <div className={styles.resultArea}>
      </div>
    </div>
  );
};
export default StagePrediction;
