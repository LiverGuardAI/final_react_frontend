import React, { useEffect, useState } from 'react';
import styles from '../../pages/doctor/AIAnalysis.module.css';
import type { ClinicalFeature, GenomicFeature, RadioFeature } from '../../api/predictionApi';
import {
  getPatientCtSeries,
  getPatientLabResults,
  getPatientGenomicData,
  getPatientHCCDiagnosis,
  getPatientProfile,
  type CtSeriesItem,
  type LabResult,
  type GenomicDataItem,
  type HCCDiagnosis,
  type PatientProfile,
} from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';

interface FeatureSelectRowProps {
  radioList: RadioFeature[];
  clinicalList: ClinicalFeature[];
  genomicList?: GenomicFeature[];
  selectedRadioId: string;
  selectedClinicalId: string;
  selectedGenomicId?: string;
  selectedHccId?: string;
  onRadioChange: (value: string) => void;
  onClinicalChange: (value: string) => void;
  onGenomicChange?: (value: string) => void;
  onHccChange?: (value: string) => void;
  onCtSeriesSelect?: (value: CtSeriesItem | null) => void;
  onPatientProfileSelect?: (value: PatientProfile | null) => void;
  onLabResultSelect?: (value: LabResult | null) => void;
  onGenomicDataSelect?: (value: GenomicDataItem | null) => void;
  onHccDiagnosisSelect?: (value: HCCDiagnosis | null) => void;
  formatDate: (dateStr?: string | null) => string;
  disabled?: boolean;
}

const FeatureSelectRow: React.FC<FeatureSelectRowProps> = ({
  radioList,
  clinicalList,
  genomicList,
  selectedRadioId,
  selectedClinicalId,
  selectedGenomicId,
  selectedHccId,
  onRadioChange,
  onClinicalChange,
  onGenomicChange,
  onHccChange,
  onCtSeriesSelect,
  onPatientProfileSelect,
  onLabResultSelect,
  onGenomicDataSelect,
  onHccDiagnosisSelect,
  formatDate,
  disabled = false,
}) => {
  const { selectedPatientId } = useTreatment();
  const patientId = selectedPatientId || '';
  const [ctSeriesList, setCtSeriesList] = useState<CtSeriesItem[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [genomicData, setGenomicData] = useState<GenomicDataItem[]>([]);
  const [hccDiagnoses, setHccDiagnoses] = useState<HCCDiagnosis[]>([]);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);

  useEffect(() => {
    if (!patientId) {
      setCtSeriesList([]);
      return;
    }
    const loadCtSeries = async () => {
      try {
        const data = await getPatientCtSeries(patientId);
        setCtSeriesList(data.results || []);
      } catch (error) {
        console.error('Failed to fetch CT series list:', error);
        setCtSeriesList([]);
      }
    };

    loadCtSeries();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) {
      setPatientProfile(null);
      onPatientProfileSelect?.(null);
      return;
    }
    const loadPatientProfile = async () => {
      try {
        const data = await getPatientProfile(patientId);
        setPatientProfile(data);
        onPatientProfileSelect?.(data);
      } catch (error) {
        console.error('Failed to fetch patient profile:', error);
        setPatientProfile(null);
        onPatientProfileSelect?.(null);
      }
    };

    loadPatientProfile();
  }, [onPatientProfileSelect, patientId]);

  useEffect(() => {
    if (!patientId) {
      setLabResults([]);
      return;
    }
    const loadLabResults = async () => {
      try {
        const data = await getPatientLabResults(patientId, 30);
        setLabResults(data.results || []);
      } catch (error) {
        console.error('Failed to fetch lab results:', error);
        setLabResults([]);
      }
    };

    loadLabResults();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) {
      setGenomicData([]);
      return;
    }
    const loadGenomicData = async () => {
      try {
        const data = await getPatientGenomicData(patientId, 30);
        setGenomicData(data.results || []);
      } catch (error) {
        console.error('Failed to fetch genomic data:', error);
        setGenomicData([]);
      }
    };

    loadGenomicData();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) {
      setHccDiagnoses([]);
      return;
    }
    const loadHccDiagnosis = async () => {
      try {
        const data = await getPatientHCCDiagnosis(patientId);
        setHccDiagnoses(data.results || []);
      } catch (error) {
        console.error('Failed to fetch HCC diagnosis list:', error);
        setHccDiagnoses([]);
      }
    };

    loadHccDiagnosis();
  }, [patientId]);

  useEffect(() => {
    if (!onLabResultSelect) return;
    if (!selectedClinicalId || !labResults.length) {
      onLabResultSelect(null);
      return;
    }
    const labId = Number(selectedClinicalId);
    const match = Number.isNaN(labId)
      ? null
      : labResults.find((item) => item.lab_id === labId) || null;
    onLabResultSelect(match);
  }, [labResults, onLabResultSelect, selectedClinicalId]);

  useEffect(() => {
    if (!onCtSeriesSelect) return;
    if (!selectedRadioId || !ctSeriesList.length) {
      onCtSeriesSelect(null);
      return;
    }
    const match = ctSeriesList.find((item) => item.series_uid === selectedRadioId) || null;
    onCtSeriesSelect(match);
  }, [ctSeriesList, onCtSeriesSelect, selectedRadioId]);

  useEffect(() => {
    if (!onPatientProfileSelect) return;
    onPatientProfileSelect(patientProfile);
  }, [onPatientProfileSelect, patientProfile]);

  useEffect(() => {
    if (!onGenomicDataSelect) return;
    if (!selectedGenomicId || !genomicData.length) {
      onGenomicDataSelect(null);
      return;
    }
    const genomicId = Number(selectedGenomicId);
    const match = Number.isNaN(genomicId)
      ? null
      : genomicData.find((item) => item.genomic_id === genomicId) || null;
    onGenomicDataSelect(match);
  }, [genomicData, onGenomicDataSelect, selectedGenomicId]);

  useEffect(() => {
    if (!onHccDiagnosisSelect) return;
    if (!selectedHccId || !hccDiagnoses.length) {
      onHccDiagnosisSelect(null);
      return;
    }
    const hccId = Number(selectedHccId);
    const match = Number.isNaN(hccId)
      ? null
      : hccDiagnoses.find((item) => item.hcc_id === hccId) || null;
    onHccDiagnosisSelect(match);
  }, [hccDiagnoses, onHccDiagnosisSelect, selectedHccId]);

  const hasPatient = Boolean(patientId);
  const hasCtSeries = ctSeriesList.length > 0;
  const hasLabResults = labResults.length > 0;
  const hasGenomicData = genomicData.length > 0;
  const hasHccDiagnoses = hccDiagnoses.length > 0;
  const effectiveRadioId = hasPatient ? selectedRadioId : '';
  const effectiveClinicalId = hasPatient ? selectedClinicalId : '';
  const effectiveGenomicId = hasPatient ? (selectedGenomicId || '') : '';
  const effectiveHccId = hasPatient ? (selectedHccId || '') : '';
  const formatStudyDate = (value?: string) => {
    if (!value) return '';
    const dateOnly = value.split('T')[0];
    return dateOnly || '';
  };
  const formatSeriesLabel = (series: CtSeriesItem) => {
    const studyDate = formatStudyDate(series.study__study_datetime || series.acquisition_datetime);
    const dateLabel = studyDate ? `${studyDate}` : '날짜 미상';
    const bodyPart = series.study__body_part ? ` ${series.study__body_part}` : '';
    const description = series.series_description ? ` - ${series.series_description}` : '';
    return `${dateLabel}${bodyPart}${description}`;
  };
  const truncateLabel = (label: string, maxLength = 36) =>
    label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
  const selectedSeries = ctSeriesList.find((item) => item.series_uid === effectiveRadioId);
  const selectedSeriesLabel = selectedSeries ? formatSeriesLabel(selectedSeries) : '';

  return (
    <>
      <div className={styles.selectWrapper}>
        <span className={styles.selectLabel}>CT 데이터:</span>
        <select
          className={styles.selectInput}
          value={effectiveRadioId}
          onChange={(e) => onRadioChange(e.target.value)}
          disabled={disabled}
          title={selectedSeriesLabel}
        >
          <option value="" disabled hidden>
            CT 데이터 선택
          </option>
            {!hasPatient ? (
              <option value="no-patient" disabled>
                진료 중인 환자가 없습니다
              </option>
            ) : hasCtSeries ? (
              ctSeriesList.map((series) => (
                <option
                  key={series.series_uid}
                  value={series.series_uid}
                  title={formatSeriesLabel(series)}
                >
                  {truncateLabel(formatSeriesLabel(series))}
                </option>
              ))
            ) : (
              <option value="no-data" disabled>
                CT series 목록이 없습니다
              </option>
            )}
        </select>
      </div>

      <div className={styles.selectWrapper}>
        <span className={styles.selectLabel}>혈액 데이터:</span>
        <select
          className={styles.selectInput}
          value={effectiveClinicalId}
          onChange={(e) => onClinicalChange(e.target.value)}
          disabled={disabled}
        >
          <option value="" disabled hidden>
            혈액 데이터 선택
          </option>
            {!hasPatient ? (
              <option value="no-patient" disabled>
                진료 중인 환자가 없습니다
              </option>
            ) : hasLabResults ? (
              labResults.map((lab) => (
                <option key={lab.lab_id} value={String(lab.lab_id)}>
                  {formatDate(lab.test_date)}
                </option>
              ))
            ) : (
              <option value="no-data" disabled>
                혈액 검사 목록이 없습니다
              </option>
            )}
        </select>
      </div>

      {genomicList && onGenomicChange ? (
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>유전체 데이터:</span>
          <select
            className={styles.selectInput}
            value={effectiveGenomicId}
            onChange={(e) => onGenomicChange(e.target.value)}
            disabled={disabled}
          >
            <option value="" disabled hidden>
              유전체 데이터 선택
            </option>
            {!hasPatient ? (
              <option value="no-patient" disabled>
                진료 중인 환자가 없습니다
              </option>
            ) : hasGenomicData ? (
              genomicData.map((item) => (
                <option key={item.genomic_id} value={String(item.genomic_id)}>
                  {formatDate(item.sample_date)}
                </option>
              ))
            ) : (
              <option value="no-data" disabled>
                유전자 검사 목록이 없습니다
              </option>
            )}
          </select>
        </div>
      ) : null}

      {onHccChange ? (
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>HCC 진단:</span>
          <select
            className={styles.selectInput}
            value={effectiveHccId}
            onChange={(e) => onHccChange(e.target.value)}
            disabled={disabled}
          >
            <option value="" disabled hidden>
              HCC 진단 선택
            </option>
            {!hasPatient ? (
              <option value="no-patient" disabled>
                진료 중인 환자가 없습니다
              </option>
            ) : hasHccDiagnoses ? (
              hccDiagnoses.map((diagnosis) => (
                <option key={diagnosis.hcc_id} value={String(diagnosis.hcc_id)}>
                  {formatDate(diagnosis.measured_at || diagnosis.hcc_diagnosis_date)}
                </option>
              ))
            ) : (
              <option value="no-data" disabled>
                HCC 진단 목록이 없습니다
              </option>
            )}
          </select>
        </div>
      ) : null}
    </>
  );
};

export default FeatureSelectRow;
