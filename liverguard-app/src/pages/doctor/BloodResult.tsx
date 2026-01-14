// src/pages/doctor/BloodResult.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
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

export default function BloodResultPage() {
  const { patientId: urlPatientId } = useParams<{ patientId: string }>();
  const { selectedPatientId } = useTreatment();
  const patientId = selectedPatientId || urlPatientId || '';
  // 개발 테스트를 위해 특정 환자 ID로 고정
  // const { patientId: routePatientId } = useParams<{ patientId: string }>();
  // const patientId = 'P20240009';

  const [results, setResults] = useState<LabResult[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('afp');
  const [loading, setLoading] = useState(false);

  // 선택된 날짜 인덱스 (기본값: 가장 최신 = results.length - 1)
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(-1);

  useEffect(() => {
    if (!patientId) {
      setResults([]);
      return;
    }
    setLoading(true);
    getPatientLabResults(patientId).then(data => {
      // 과거 -> 최신 순으로 정렬 (그래프용)
      const sorted = data.results
        .slice()
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

  // 선택된 날짜의 결과 데이터
  const selectedData = selectedDateIndex >= 0 && results[selectedDateIndex]
    ? results[selectedDateIndex]
    : undefined;

  // 그래프용 데이터 변환
  const chartData = useMemo(() => {
    return results.map(r => {
      const val = r[selectedMetric as keyof LabResult];
      return {
        date: (r.measured_at || r.test_date).split('T')[0],
        value: getChartValue(selectedMetric, val), // 문자열(A,B,C)을 숫자로 변환
        originalValue: val // 툴팁 표시용 원본 값
      };
    });
  }, [results, selectedMetric]);

  // 현재 선택된 항목의 설정 값
  const config = LAB_CONFIG[selectedMetric];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.patientInfo}>
          Patient ID : {patientId || '-'}
          <span className={styles.divider}>|</span>
          {/*"Sample Date" + 선택된 날짜 표시 */}
          Sample Date : {selectedData?.measured_at?.split('T')[0] || '-'}
        </div>

        {/* 오른쪽에 날짜 선택 드롭다운 */}
        <div className={styles.dateSelector}>
          <span className={styles.dateSelectorLabel}>날짜 선택:</span>
          <select
            value={selectedDateIndex}
            onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
            className={styles.dateDropdown}
          >
            {results.map((r, idx) => (
              <option key={idx} value={idx}>
                {r.test_date.split('T')[0]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* 1. Summary Cards Section - selectedData 사용 */}
      <div className={styles.cardsGrid}>
        {Object.entries(LAB_CONFIG).map(([key, conf]) => {
          // selectedData 사용
          const value = selectedData ? (selectedData[key as keyof LabResult] as number) : undefined;
          const status = getStatus(key, value);
          const isSelected = selectedMetric === key;

          return (
            <div
              key={key}
              className={`${styles.card} ${styles[status]} ${isSelected ? styles.selected : ''}`}
              onClick={() => setSelectedMetric(key)}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardLabel}>{conf.label}</span>
                {status === 'danger' && <span className={styles.riskDot} />}
              </div>
              <div className={styles.cardBody}>
                {/* 로딩 중이면 ... 표시, 아니면 값 또는 - */}
                <span className={styles.value}>
                  {loading ? '...' : (value ?? '-')}
                </span>
                <span className={styles.unit}>{conf.unit}</span>
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.refRange}>
                  {/* 범위 정보가 있으면 표시 */}
                  {conf.min || conf.max ? `Ref : ${conf.min || ''} ~ ${conf.max || ''}` : ' '}
                </span>
                <span className={`${styles.badge} ${styles[status]}`}>
                  {status === 'normal' ? 'Normal' : status === 'warning' ? 'Warning' : 'Risk'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Trend Graph Section */}
      <div className={styles.chartSection}>
        <h3 className={styles.sectionTitle}>{config.label} Trend Analysis</h3>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              {/* 그라데이션 정의 */}
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                domain={['auto', 'auto']} // 데이터 범위에 맞춰 자동 조정
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (active && payload && payload.length) {
                    const dataItem = payload[0].payload;
                    const val = Number(dataItem.originalValue);

                    let color = '#3b82f6'; // 기본: 파랑 (Normal)
                    if (config.max !== undefined && val > config.max) color = '#ef4444'; // 높음: 빨강
                    else if (config.min !== undefined && val < config.min) color = '#eab308'; // 낮음: 노랑

                    return (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>{label}</p>
                        <p style={{ color: color }}>
                          {config.label}: {dataItem.originalValue} {config.unit}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {config.max && selectedMetric !== 'albi_score' && (
                <ReferenceLine y={config.max} stroke="#ef4444" strokeDasharray="3 3" label="Max" />
              )}

              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#blueGradient)"
                dot={{ r: 5, fill: 'white', stroke: '#2563eb', strokeWidth: 2 }}
                activeDot={{ r: 8, fill: '#2563eb', stroke: 'white', strokeWidth: 2 }}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
          {/* 데이터가 없을 때 안내 메시지 (그래프 위에 겹쳐서 표시) */}
          {!loading && chartData.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '-180px', color: '#9ca3af', position: 'relative', zIndex: 10 }}>
              No trend data
            </div>
          )}
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
                <th>Test</th>
                <th>Result</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                    {loading ? 'Loading history...' : 'No result history found.'}
                  </td>
                </tr>
              ) : (
                [...results].reverse().slice(0, 10).map((row, idx) => {
                  const val = row[selectedMetric as keyof LabResult] as number;
                  const status = getStatus(selectedMetric, val);

                  return (
                    <tr key={idx}>
                      <td>{row.test_date.split('T')[0]}</td>
                      <td className={styles.cellTestName}>{config.label}</td>
                      <td className={styles.cellValue}>{val ?? '-'} {config.unit}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[status]}`}>
                          {status === 'normal' ? 'Normal' : 'Risk'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
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
