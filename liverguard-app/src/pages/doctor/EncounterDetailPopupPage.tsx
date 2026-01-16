import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getEncounterDetail, type EncounterDetail } from '../../api/doctorApi';
import styles from './EncounterDetailPopupPage.module.css';

const formatDateTime = (detail: EncounterDetail) => {
  const date = (detail as any).record_date || detail.encounter_date;
  const time = (detail as any).record_time || detail.encounter_time;
  if (!date && !time) {
    return '-';
  }
  return [date, time].filter(Boolean).join(' ');
};

export default function EncounterDetailPopupPage() {
  const { encounterId } = useParams();
  const numericId = useMemo(() => Number(encounterId), [encounterId]);
  const [detail, setDetail] = useState<EncounterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      if (!Number.isFinite(numericId)) {
        if (isMounted) {
          setError('잘못된 진료 기록 번호입니다.');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await getEncounterDetail(numericId);
        if (isMounted) {
          setDetail(data);
        }
      } catch (err) {
        console.error('진료 기록 상세 로드 실패:', err);
        if (isMounted) {
          setError('상세 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [numericId]);

  const patient = detail?.patient;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>진료 기록 상세</h1>
            <p className={styles.subtitle}>
              {patient?.name || '환자'} ({patient?.patient_id || '-'})
            </p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.closeButton} onClick={() => window.close()}>
              닫기
            </button>
          </div>
        </div>
        <div className={styles.body}>
          {loading && <div className={styles.stateText}>로딩 중...</div>}
          {!loading && error && <div className={styles.stateText}>{error}</div>}
          {!loading && !error && detail && (
            <div className={styles.sectionStack}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>기본 정보</h2>
                <div className={styles.grid}>
                  <div className={styles.field}>
                    <span className={styles.label}>성별/나이</span>
                    <span className={styles.value}>
                      {patient?.gender === 'M' ? '남' : patient?.gender === 'F' ? '여' : '-'} / {patient?.age ?? '-'}세
                    </span>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.label}>진료일시</span>
                    <span className={styles.value}>{formatDateTime(detail)}</span>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.label}>진료의사</span>
                    <span className={styles.value}>{detail.doctor_name || '-'}</span>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.label}>진료상태</span>
                    <span className={styles.value}>{detail.encounter_status_display || '-'}</span>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.label}>진료실</span>
                    <span className={styles.value}>{detail.clinic_room || '-'}</span>
                  </div>
                  <div className={styles.field}>
                    <span className={styles.label}>진단명</span>
                    <span className={styles.value}>{detail.diagnosis_name || '없음'}</span>
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>진료 내용</h2>
                <div className={styles.block}>
                  <span className={styles.label}>주증상</span>
                  <p className={styles.text}>{detail.chief_complaint || '없음'}</p>
                </div>
                <div className={styles.block}>
                  <span className={styles.label}>진료 소견</span>
                  <p className={styles.text}>{detail.clinical_notes || '없음'}</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
