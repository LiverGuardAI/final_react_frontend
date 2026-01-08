import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../../api/predictionApi';
import styles from './AIAnalysis.module.css';

/**
 * Task 2: Recurrence Prediction (간암 조기 재발 예측)
 * - Uses CT features, clinical features, and Genomic (mRNA) data.
 */
const RecurrencePrediction: React.FC = () => {
  const { patientId: urlPatientId } = useParams();
  const navigate = useNavigate();

  // 상태 관리
  const [selectedPatient, setSelectedPatient] = useState(urlPatientId || '');
  const [radioList, setRadioList] = useState<api.RadioFeature[]>([]);
  const [clinicalList, setClinicalList] = useState<api.ClinicalFeature[]>([]);
  const [genomicList, setGenomicList] = useState<api.GenomicFeature[]>([]);

  const [selectedRadioId, setSelectedRadioId] = useState('');
  const [selectedClinicalId, setSelectedClinicalId] = useState('');
  const [selectedGenomicId, setSelectedGenomicId] = useState('');
  const [loading, setLoading] = useState(false);

  // 환자 데이터 로드 (실제 API 연동)
  useEffect(() => {
    const loadFeatures = async () => {
      if (selectedPatient) {
        setLoading(true);
        try {
          const data = await api.fetchAllFeatures(selectedPatient);
          setRadioList(data.radio);
          setClinicalList(data.clinical);
          setGenomicList(data.genomic);
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
          <select className={styles.selectInput} value={selectedPatient} onChange={(e) => {
              setSelectedPatient(e.target.value);
              navigate(`/doctor/ai-recurrence-prediction/${e.target.value}`);
            }}
          >
            <option value={selectedPatient}>{selectedPatient}</option>
          </select>
        </div>

        {/* CT 목록창 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>CT 데이터:</span>
          <select className={styles.selectInput} value={selectedRadioId}
            onChange={(e) => setSelectedRadioId(e.target.value)}
            disabled={!selectedPatient || loading}
          >
            <option value="">데이터 선택</option>
            {radioList.map(r => (
              <option key={r.radio_vector_id} value={r.radio_vector_id}>{r.study_date}</option>
            ))}
          </select>
        </div>

        {/* 혈액 데이터 목록창 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>혈액 데이터:</span>
          <select className={styles.selectInput} value={selectedClinicalId}
            onChange={(e) => setSelectedClinicalId(e.target.value)}
            disabled={!selectedPatient || loading}
          >
            <option value="">데이터 선택</option>
            {clinicalList.map(c => (
              <option key={c.clinical_vector_id} value={c.clinical_vector_id}>{c.lab_date}</option>
            ))}
          </select>
        </div>

        {/* 유전체 데이터 목록창 */}
        <div className={styles.selectWrapper}>
          <span className={styles.selectLabel}>유전체 데이터:</span>
          <select className={styles.selectInput} value={selectedGenomicId}
            onChange={(e) => setSelectedGenomicId(e.target.value)}
            disabled={!selectedPatient || loading}
          >
            <option value="">데이터 선택</option>
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
            <span className={styles.infoLabel}>CT 촬영 날짜 :</span>
            <span>{radioList.find(r => r.radio_vector_id === selectedRadioId)?.study_date || ' -'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>혈액 검사 날짜 :</span>
            <span>{clinicalList.find(c => c.clinical_vector_id === selectedClinicalId)?.lab_date || ' -'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>유전체 검사 날짜 :</span>
            <span>{genomicList.find(g => g.genomic_id === selectedGenomicId)?.sample_date || ' -'}</span>
          </div>
        </div>
      </div>

      <div className={styles.actionArea}>
        <button className={styles.predictBtn} onClick={handleRunAnalysis}
          disabled={!selectedRadioId || !selectedClinicalId || !selectedGenomicId}
        >
          분석 실행
        </button>
      </div>

      <div className={styles.resultArea}>
        <p className={styles.placeholderText}>
          데이터를 선택하고 분석 실행 버튼을 눌러주세요.
        </p>
      </div>
    </div>
  );
};

export default RecurrencePrediction;
