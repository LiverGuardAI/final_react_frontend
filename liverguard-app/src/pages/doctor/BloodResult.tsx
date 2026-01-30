// src/pages/doctor/BloodResult.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import styles from './BloodResult.module.css';
import { getPatientLabResults, type LabResult } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';

// 설정: 각 검사 항목의 라벨, 단위, 정상 범위
const LAB_CONFIG: Record<string, { label: string; unit: string; min?: number; max?: number }> = {
  afp: { label: 'AFP (Alpha-fetoprotein)', unit: 'ng/mL', max: 7 },
  albumin: { label: 'Albumin', unit: 'g/dL', min: 3.5, max: 5.5 },
  bilirubin_total: { label: 'Total Bilirubin', unit: 'mg/dL', max: 1.2 },
  platelet: { label: 'Platelet', unit: '10^3/uL', min: 150, max: 450 },
  pt_inr: { label: 'PT (INR)', unit: '', min: 0.8, max: 1.2 },
  creatinine: { label: 'Creatinine', unit: 'mg/dL', min: 0.6, max: 1.2 },

  // 추가 간 기능 지표
  child_pugh_class: { label: 'Child-Pugh Class', unit: '' },
  meld_score: { label: 'MELD Score', unit: 'pts', max: 20 },
  albi_score: { label: 'ALBI Score', unit: 'pts', max: -1.39 }, // -1.39 보다 높으면(덜 음수면) 안좋음
  albi_grade: { label: 'ALBI Grade', unit: 'Gr' },
};

const LINE_COLORS: Record<string, string> = {
  afp: '#204ba8ff',
  albumin: '#059669',
  bilirubin_total: '#e9dd37ff',
  platelet: '#7c3aed',
  pt_inr: '#cc3ba1ff',
  creatinine: '#0284c7',
  child_pugh_class: '#ca8a04',
  meld_score: '#dc2626',
  albi_score: '#180303ff',
  albi_grade: '#064b34ff',
};

export default function BloodResultPage() {
  const { patientId: urlPatientId } = useParams<{ patientId: string }>();
  const { selectedPatientId } = useTreatment();
  const patientId = selectedPatientId || urlPatientId || '';
  // 개발 테스트를 위해 특정 환자 ID로 고정
  // const { patientId: routePatientId } = useParams<{ patientId: string }>();
  // const patientId = 'P20240009';

  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(-1);
  const cardsRowRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!patientId) {
      setResults([]);
      return;
    }
    setLoading(true);
    getPatientLabResults(patientId).then(data => {
      const uniqueLabMap = new Map<string, LabResult>();
      data.results.forEach(item => {
        const date = (item.measured_at || item.test_date).split('T')[0];
        const existing = uniqueLabMap.get(date);

        if (!existing) {
          uniqueLabMap.set(date, item);
        } else {
          // Platelet 수치가 더 높은 것(실제 데이터) 우선, 같다면 최신 시간 우선
          const existingPlatelet = existing.platelet || 0;
          const newPlatelet = item.platelet || 0;

          if (newPlatelet > existingPlatelet) {
            uniqueLabMap.set(date, item);
          } else if (newPlatelet === existingPlatelet) {
            const t1 = new Date(existing.measured_at || existing.test_date).getTime();
            const t2 = new Date(item.measured_at || item.test_date).getTime();
            if (t2 > t1) uniqueLabMap.set(date, item);
          }
        }
      });

      // Map -> Array 변환 및 날짜순 정렬
      const sorted = Array.from(uniqueLabMap.values())
        .sort((a, b) =>
          new Date(a.measured_at || a.test_date).getTime() - new Date(b.measured_at || b.test_date).getTime()
        );
      setResults(sorted);
      // 데이터 로드 후, 가장 최신 날짜를 기본 선택
      setSelectedDateIndex(sorted.length ? sorted.length - 1 : -1);
    }).catch(err => {
      console.error(err);
      setResults([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [patientId]);

  // 모달 제어 State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMetric, setModalMetric] = useState<string | null>(null);
  // 그래프 표시 여부 (체크박스)
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>(
    Object.keys(LAB_CONFIG).reduce((acc, key) => ({ ...acc, [key]: true }), {})
  );

  const selectedData = selectedDateIndex >= 0 && results[selectedDateIndex]
    ? results[selectedDateIndex]
    : undefined;
  // 멀티라인 그래프용 데이터 변환 (구간별 선형 정규화)
  const multiLineChartData = useMemo(() => {
    return results.map(r => {
      const dataPoint: Record<string, any> = {
        date: (r.measured_at || r.test_date).split('T')[0],
      };

      Object.entries(LAB_CONFIG).forEach(([key, conf]) => {
        const rawValue = r[key as keyof LabResult] as number;
        if (rawValue === undefined || rawValue === null) {
          dataPoint[key] = null;
          return;
        }

        const min = conf.min ?? 0;
        const max = conf.max ?? 100;
        let normalized = 50;
        // 구간별 선형 정규화: 정상 범위(min~max)를 30~70으로 매핑
        if (rawValue >= min && rawValue <= max) {
          // 정상 범위 내: 30 ~ 70
          normalized = 30 + ((rawValue - min) / (max - min || 1)) * 40;
        } else if (rawValue > max) {
          // 정상 초과: 70 ~ 100
          const overflow = (rawValue - max) / (Math.abs(max) || 1);
          normalized = 70 + Math.min(overflow * 30, 30);
        } else {
          // 정상 미달: 0 ~ 30
          const underflow = (min - rawValue) / (Math.abs(min) || 1);
          normalized = 30 - Math.min(underflow * 30, 30);
        }
        dataPoint[key] = Math.min(Math.max(normalized, 0), 100);
        dataPoint[`${key}_raw`] = rawValue; // 툴팁용 원본 값
      });
      return dataPoint;
    });
  }, [results]);

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>
          Patient ID : <span style={{ color: '#2563eb' }}>{patientId}</span>
          <span style={{ margin: '0 15px', color: '#e2e8f0' }}>|</span>
          Date : <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{selectedData?.measured_at?.split('T')[0] || '-'}</span>
        </div>
        <select
          value={selectedDateIndex}
          onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
        >
          {[...results].reverse().map((r, idx) => (
            <option key={idx} value={results.length - 1 - idx}>
              {r.test_date.split('T')[0]}
            </option>
          ))}
        </select>
      </header>

      <div className={styles.cardsRowWrapper}>
        <button
          type="button"
          className={styles.carouselButton}
          onClick={() => {
            if (!cardsRowRef.current) return;
            cardsRowRef.current.scrollBy({ left: -cardsRowRef.current.clientWidth * 0.7, behavior: 'smooth' });
          }}
          aria-label="좌측 혈액지표 보기"
        >
          ‹
        </button>
        <div className={styles.cardsGrid} ref={cardsRowRef}>
          {Object.entries(LAB_CONFIG).map(([key, conf]) => {
            const value = selectedData ? (selectedData[key as keyof LabResult] as number) : undefined;
            const status = getStatus(key, value);
            const isSelected = modalMetric === key;

            return (
              <div
                key={key}
                className={`${styles.card} ${styles[status]} ${isSelected ? styles.selected : ''}`}
                onClick={() => {
                  setModalMetric(key);
                  setModalOpen(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>{conf.label}</span>
                  {status === 'danger' && <span className={styles.riskDot} />}
                </div>
                <div className={styles.cardBody}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span className={styles.value}>{loading ? '...' : (value ?? '-')}</span>
                      <span className={styles.unit}>{conf.unit}</span>
                    </div>
                    <span className={`${styles.badge} ${styles[status]}`}>
                      {status === 'normal' ? 'Normal' : status === 'warning' ? 'Warning' : 'Risk'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className={styles.carouselButton}
          onClick={() => {
            if (!cardsRowRef.current) return;
            cardsRowRef.current.scrollBy({ left: cardsRowRef.current.clientWidth * 0.7, behavior: 'smooth' });
          }}
          aria-label="우측 혈액지표 보기"
        >
          ›
        </button>
      </div>

      {/* 2. Multi-Line Trend Graph Section (10종 종합) */}
      <div className={styles.chartSection}>
        <h3 className={styles.sectionTitle}>종합 혈액 지표 추이</h3>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* 그래프 영역 */}
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={multiLineChartData} margin={{ top: 20, right: 40, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <ReferenceArea y1={30} y2={70} fill="#22c55e" fillOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis domain={[0, 150]} axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', fontSize: '12px' }}>
                          <p style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>{label}</p>
                          {payload.map((p: any) => {
                            if (p.value === null) return null;
                            const rawKey = `${p.dataKey}_raw`;
                            return (
                              <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.stroke }}></span>
                                <span style={{ color: '#374151' }}>{LAB_CONFIG[p.dataKey]?.label.split('(')[0]}:</span>
                                <span style={{ fontWeight: 'bold' }}>{p.payload[rawKey]} {LAB_CONFIG[p.dataKey]?.unit}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {Object.entries(LAB_CONFIG).map(([key]) => (
                  visibleMetrics[key] && (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={LINE_COLORS[key] || '#9ca3af'}
                      strokeWidth={2}
                      dot={{ r: 3, fill: LINE_COLORS[key] || '#9ca3af', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 우측 범례 (체크박스) */}
          <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px', background: '#f9fafb', borderRadius: '8px', marginTop: '5px' }}>
            {/* 전체 선택 체크박스 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', marginBottom: '4px' }}>
              <input
                type="checkbox"
                checked={Object.values(visibleMetrics).every(v => v)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  const newVisible: Record<string, boolean> = {};
                  Object.keys(LAB_CONFIG).forEach(k => newVisible[k] = checked);
                  setVisibleMetrics(newVisible);
                }}
                style={{ accentColor: '#3b82f6' }}
              />
              <span>Select All</span>
            </label>
            {Object.entries(LAB_CONFIG).map(([key, conf]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={visibleMetrics[key]}
                  onChange={() => setVisibleMetrics(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{ accentColor: LINE_COLORS[key] }}
                />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: LINE_COLORS[key] }} />
                <span>{conf.label.split('(')[0]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Historical Table Section */}
      <div className={styles.tableSection}>
        <h3 className={styles.sectionTitle}>Historical Test Results</h3>
        <div className={styles.tableResponsive}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Date</th>
                {Object.entries(LAB_CONFIG).map(([key, conf]) => (
                  <th key={key} style={{ fontSize: '11px', whiteSpace: 'nowrap', textAlign: 'center' }}>{conf.label.split('(')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={Object.keys(LAB_CONFIG).length + 1} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                    {loading ? 'Loading history...' : 'No result history found.'}
                  </td>
                </tr>
              ) : (
                [...results].reverse().slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ whiteSpace: 'nowrap' }}>{row.test_date.split('T')[0]}</td>
                    {Object.entries(LAB_CONFIG).map(([key, conf]) => {
                      const val = row[key as keyof LabResult];
                      const status = getStatus(key, val);
                      return (
                        <td key={key} style={{ textAlign: 'center', padding: '8px 4px' }}>
                          <span style={{
                            fontSize: '12px',
                            color: status === 'normal' ? '#2bd46cff' : status === 'danger' ? '#bd3636ff' : '#d16e30ff'
                          }}>
                            {val ?? '-'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Detail Modal */}
      {modalOpen && modalMetric && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ backgroundColor: 'white', width: '550px', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{LAB_CONFIG[modalMetric].label} 상세 정보</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: LINE_COLORS[modalMetric] }}>
                {selectedData?.[modalMetric as keyof LabResult] ?? '-'} <span style={{ fontSize: '16px', color: '#6b7280' }}>{LAB_CONFIG[modalMetric].unit}</span>
              </div>
              {(LAB_CONFIG[modalMetric].min !== undefined || LAB_CONFIG[modalMetric].max !== undefined) && (
                <div style={{ marginTop: '8px', color: '#6b7280' }}>
                  정상 범위: {LAB_CONFIG[modalMetric].min ?? ''} ~ {LAB_CONFIG[modalMetric].max ?? ''}
                </div>
              )}
              <span style={{ display: 'inline-block', marginTop: '8px', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: getStatus(modalMetric, selectedData?.[modalMetric as keyof LabResult]) === 'normal' ? '#dcfce7' : '#fee2e2', color: getStatus(modalMetric, selectedData?.[modalMetric as keyof LabResult]) === 'normal' ? '#166534' : '#991b1b' }}>
                {getStatus(modalMetric, selectedData?.[modalMetric as keyof LabResult]) === 'normal' ? '정상 범위' : '주의 필요'}
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>추세</h4>
              {(() => {
                if (results.length < 2) return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: '#f3f4f6', color: '#374151' }}>데이터 부족</span>;
                const len = results.length;
                const first = Number(results[Math.max(0, len - 3)]?.[modalMetric as keyof LabResult]) || 0;
                const last = Number(results[len - 1]?.[modalMetric as keyof LabResult]) || 0;
                const diff = last - first;

                if (diff > 0.1) return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }}>↑ 상승 중</span>;
                if (diff < -0.1) return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: '#dcfce7', color: '#166534', fontWeight: 'bold' }}>↓ 하강 중</span>;
                return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: '#f3f4f6', color: '#374151', fontWeight: 'bold' }}>→ 유지</span>;
              })()}
            </div>

            <div>
              <h4 style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>과거 기록</h4>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={results.map(r => ({ date: r.test_date.split('T')[0], value: getChartValue(modalMetric, r[modalMetric as keyof LabResult]), raw: r[modalMetric as keyof LabResult] }))} margin={{ bottom: 20 }}>
                  <defs>
                    <linearGradient id="modalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={LINE_COLORS[modalMetric]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={LINE_COLORS[modalMetric]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'white', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb' }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>{label}</p>
                            <p style={{ color: LINE_COLORS[modalMetric], fontSize: '14px', fontWeight: 'bold' }}>
                              {payload[0].payload.raw} {LAB_CONFIG[modalMetric].unit}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={LINE_COLORS[modalMetric]}
                    strokeWidth={2}
                    fill="url(#modalGradient)"
                    dot={{ r: 4, fill: 'white', stroke: LINE_COLORS[modalMetric], strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: LINE_COLORS[modalMetric], stroke: 'white', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------
// Helper Functions
// ---------------------------
// 문자열 데이터(Grade 등)를 숫자로 변환하여 그래프 Y축에 매핑
function getChartValue(key: string, value: any): number {
  if (value === undefined || value === null) return 0;

  // Child-Pugh A=1, B=2, C=3
  if (key === 'child_pugh_class') {
    if (value === 'A') return 1;
    if (value === 'B') return 2;
    if (value === 'C') return 3;
    return 0;
  }
  // ALBI Grade '1'=1, '2'=2 '3'=3
  if (key === 'albi_grade') {
    return parseInt(value) || 0;
  }

  // 일반 수치 데이터
  return Number(value) || 0;
}
// 상태(Normal/Warning/Risk) 판별
function getStatus(key: string, value: any): 'normal' | 'danger' | 'warning' {
  if (value === undefined || value === null) return 'normal';
  // 1. Child-Pugh Class (C=Risk, B=Warning)
  if (key === 'child_pugh_class') {
    if (value === 'C') return 'danger';
    if (value === 'B') return 'warning';
    return 'normal';
  }
  // 2. ALBI Grade (3=Risk, 2=Warning)
  if (key === 'albi_grade') {
    // 문자열 "1", "2", "3" 비교
    if (String(value) === '3') return 'danger';
    if (String(value) === '2') return 'warning';
    return 'normal';
  }
  // 3. 일반 수치 비교
  const numVal = Number(value);
  if (isNaN(numVal)) return 'normal';
  const conf = LAB_CONFIG[key];
  if (!conf) return 'normal';
  // ALBI Score는 높을수록(덜 음수일수록) 안좋음. 예: -0.5 > -1.39 (Risk)
  // 일반적인 항목은 높으면 안좋거나 낮으면 안좋음
  if (conf.max !== undefined && numVal > conf.max) return 'danger';
  if (conf.min !== undefined && numVal < conf.min) return 'danger';

  return 'normal';
}
