import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../../api/predictionApi';
import * as adminApi from '../../api/administration_api';
import styles from './AIAnalysis.module.css';

/**
 * Task 2: Recurrence Prediction (간암 조기 재발 예측)
 * - Uses CT features, clinical features, and Genomic (mRNA) data.
 */
const RecurrencePrediction: React.FC = () => {
  const { patientId: urlPatientId } = useParams();
  const navigate = useNavigate();

  // 상태 관리
  const [patientList, setPatientList] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState(urlPatientId || '');
  const [radioList, setRadioList] = useState<api.RadioFeature[]>([]);
  const [clinicalList, setClinicalList] = useState<api.ClinicalFeature[]>([]);
  const [genomicList, setGenomicList] = useState<api.GenomicFeature[]>([]);

  const [selectedRadioId, setSelectedRadioId] = useState('');
  const [selectedClinicalId, setSelectedClinicalId] = useState('');
  const [selectedGenomicId, setSelectedGenomicId] = useState('');
  const [loading, setLoading] = useState(false);

  // 날짜 포맷팅 함수 (YYYY-MM-DD)
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  // 1. 전체 환자 목록 로드
  useEffect(() => {
    adminApi.getPatients().then(data => {
      setPatientList(data.results || data);
    });
  }, []);
  // 2. 선택된 환자의 특징 데이터 로드
  useEffect(() => {
    const loadFeatures = async () => {
      if (selectedPatient) {
        setLoading(true);
        try {
          const [radio, clinical, genomic] = await Promise.all([
            api.fetchRadioFeatures(selectedPatient),
            api.fetchClinicalFeatures(selectedPatient),
            api.fetchGenomicFeatures(selectedPatient)
          ]);
          setRadioList(radio);
          setClinicalList(clinical);
          setGenomicList(genomic);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
      }
    };
    loadFeatures();
  }, [selectedPatient]);


  const handleRunAnalysis = () => {
    if (!selectedRadioId || !selectedClinicalId || !selectedGenomicId) {
      alert('데이터(CT, 혈액, 유전체)를 모두 선택해주세요.');
      return;
    }
    console.log('재발 예측 요청:', { selectedRadioId, selectedClinicalId, selectedGenomicId });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>조기 재발 예측 (Recurrence)</h1>

      {/* 데이터 선택 영역 (상단 일렬 배치) */}
      <div className={styles.selectionHeader}>
        {/* 환자 선택 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>환자 :</span>
          <select
            className={styles.selectInput}
            value={selectedPatient}
            onChange={(e) => {
              const pid = e.target.value;
              setSelectedPatient(pid);
              navigate(`/doctor/ai-stage-prediction/${pid}`);
            }}
          >
            <option value="">- 환자를 선택하세요 -</option> 
            {patientList.map(p => (
              <option key={p.patient_id} value={p.patient_id}>{p.name} ({p.patient_id})</option>
            ))}
          </select>
        </div>

        {/* CT 목록창 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>CT 데이터:</span>
          <select className={styles.selectInput} value={selectedRadioId}
            onChange={(e) => setSelectedRadioId(e.target.value)}
            disabled={!selectedPatient}
          >
            {radioList.map(r => (
              <option key={r.radio_vector_id} value={r.radio_vector_id}>{formatDate(r.study_date)} ({r.model_name})</option>
            ))}
          </select>
        </div>

        {/* 혈액 데이터 목록창 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>혈액 데이터:</span>
          <select className={styles.selectInput} value={selectedClinicalId}
            onChange={(e) => setSelectedClinicalId(e.target.value)}
            disabled={!selectedPatient}
          >
            {clinicalList.map(c => (
              <option key={c.clinical_vector_id} value={c.clinical_vector_id}>{formatDate(c.lab_date)}</option>
            ))}
          </select>
        </div>

        {/* 유전체 데이터 목록창 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>유전체 데이터:</span>
          <select className={styles.selectInput} value={selectedGenomicId}
            onChange={(e) => setSelectedGenomicId(e.target.value)}
            disabled={!selectedPatient}
          >
            {genomicList.map(g => (
              <option key={g.genomic_id} value={g.genomic_id}>{g.sample_date} ({g.sample_id})</option>
            ))}
          </select>
        </div>
      </div>

      {/* 선택된 데이터의 날짜 정보 표시 */}
      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>선택된 데이터 정보</div>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>CT 촬영 날짜:</span>
            <span>{formatDate(radioList.find(r => r.radio_vector_id === selectedRadioId)?.study_date)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>혈액 검사 날짜:</span>
            <span>{formatDate(clinicalList.find(c => c.clinical_vector_id === selectedClinicalId)?.lab_date)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>유전체 검사 날짜 :</span>
            <span>{formatDate(genomicList.find(g => g.genomic_id === selectedGenomicId)?.sample_date)}</span>
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
export default RecurrencePrediction;
