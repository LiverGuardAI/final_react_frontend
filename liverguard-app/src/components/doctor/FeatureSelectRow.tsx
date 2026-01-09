import React, { useEffect, useState } from 'react';
import styles from '../../pages/doctor/AIAnalysis.module.css';
import type { ClinicalFeature, GenomicFeature, RadioFeature } from '../../api/predictionApi';
import {
  getPatientCtSeries,
  getPatientLabResults,
  getPatientGenomicData,
  type CtSeriesItem,
  type LabResult,
  type GenomicDataItem,
} from '../../api/doctorApi';

interface FeatureSelectRowProps {
  radioList: RadioFeature[];
  clinicalList: ClinicalFeature[];
  genomicList?: GenomicFeature[];
  selectedRadioId: string;
  selectedClinicalId: string;
  selectedGenomicId?: string;
  onRadioChange: (value: string) => void;
  onClinicalChange: (value: string) => void;
  onGenomicChange?: (value: string) => void;
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
  onRadioChange,
  onClinicalChange,
  onGenomicChange,
  formatDate,
  disabled = false,
}) => {
  const patientId = 'P20240009';
  const [ctSeriesList, setCtSeriesList] = useState<CtSeriesItem[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [genomicData, setGenomicData] = useState<GenomicDataItem[]>([]);

  useEffect(() => {
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

  const hasCtSeries = ctSeriesList.length > 0;
  const hasLabResults = labResults.length > 0;
  const hasGenomicData = genomicData.length > 0;
  const formatStudyDate = (value?: string) => {
    if (!value) return '';
    const dateOnly = value.split('T')[0];
    return dateOnly || '';
  };
  const formatSeriesLabel = (series: CtSeriesItem) => {
    const numberLabel =
      series.series_number !== undefined && series.series_number !== null
        ? `Series #${series.series_number}`
        : 'Series';
    const description = series.series_description ? ` - ${series.series_description}` : '';
    const studyDate = formatStudyDate(series.study__study_datetime);
    const dateLabel = studyDate ? ` (${studyDate})` : '';
    return `${numberLabel}${description}${dateLabel}`;
  };

  return (
    <>
      <div className={styles.selectWrapper}>
        <span className={styles.selectLabel}>CT 데이터:</span>
        <select
          className={styles.selectInput}
          value={selectedRadioId}
          onChange={(e) => onRadioChange(e.target.value)}
          disabled={disabled}
        >
          {hasCtSeries
            ? ctSeriesList.map((series) => (
                <option key={series.series_uid} value={series.series_uid}>
                  {formatSeriesLabel(series)}
                </option>
              ))
            : radioList.map((radio) => (
                <option key={radio.radio_vector_id} value={radio.radio_vector_id}>
                  {formatDate(radio.study_date)} ({radio.model_name})
                </option>
              ))}
        </select>
      </div>

      <div className={styles.selectWrapper}>
        <span className={styles.selectLabel}>혈액 데이터:</span>
        <select
          className={styles.selectInput}
          value={selectedClinicalId}
          onChange={(e) => onClinicalChange(e.target.value)}
          disabled={disabled}
        >
          {hasLabResults
            ? labResults.map((lab) => (
                <option key={lab.lab_id} value={String(lab.lab_id)}>
                  {formatDate(lab.test_date)}
                </option>
              ))
            : clinicalList.map((clinical) => (
                <option key={clinical.clinical_vector_id} value={clinical.clinical_vector_id}>
                  {formatDate(clinical.lab_date)}
                </option>
              ))}
        </select>
      </div>

      {genomicList && onGenomicChange ? (
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>유전체 데이터:</span>
          <select
            className={styles.selectInput}
            value={selectedGenomicId}
            onChange={(e) => onGenomicChange(e.target.value)}
            disabled={disabled}
          >
            {hasGenomicData
              ? genomicData.map((item) => (
                  <option key={item.genomic_id} value={String(item.genomic_id)}>
                    {formatDate(item.sample_date)}
                  </option>
                ))
              : genomicList.map((genomic) => (
                  <option key={genomic.genomic_id} value={genomic.genomic_id}>
                    {genomic.sample_date} ({genomic.sample_id})
                  </option>
                ))}
          </select>
        </div>
      ) : null}
    </>
  );
};

export default FeatureSelectRow;
