// src/pages/doctor/BloodResult.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import styles from './BloodResult.module.css';
import { getPatientLabResults, type LabResult } from '../../api/doctorApi';

// 설정: 각 검사 항목의 라벨, 단위, 정상 범위
const LAB_CONFIG: Record<string, { label: string; unit: string; min?: number; max?: number }> = {
  afp: { label: 'AFP (Alpha-fetoprotein)', unit: 'ng/mL', max: 7 },
  albumin: { label: 'Albumin', unit: 'g/dL', min: 3.5, max: 5.5 },
  bilirubin_total: { label: 'Total Bilirubin', unit: 'mg/dL', max: 1.2 },
  platelet: { label: 'Platelet', unit: '10^3/uL', min: 150, max: 450 },
  pt_inr: { label: 'PT (INR)', unit: '', min: 0.8, max: 1.2 },
  creatinine: { label: 'Creatinine', unit: 'mg/dL', min: 0.6, max: 1.2 },
};

export default function BloodResultPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [results, setResults] = useState<LabResult[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('afp'); // 기본 선택: AFP
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setResults([]);
      return;
    }
    setLoading(true);
    getPatientLabResults(patientId).then(data => {
      // 과거 -> 최신 순으로 정렬 (그래프용)
      const sorted = data.results.sort((a, b) =>
        new Date(a.test_date).getTime() - new Date(b.test_date).getTime()
      );
      setResults(sorted);
    }).catch(err => {
      console.error(err);
      setResults([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [patientId]);

  // 최신 결과 데이터 (데이터가 없으면 undefined)
  const latest = results.length > 0 ? results[results.length - 1] : undefined;

  // 그래프용 데이터 변환
  const chartData = useMemo(() => {
    return results.map(r => ({
      date: r.test_date.split('T')[0], // YYYY-MM-DD
      value: r[selectedMetric as keyof LabResult] as number || 0,
    }));
  }, [results, selectedMetric]);

  // 현재 선택된 항목의 설정 값
  const config = LAB_CONFIG[selectedMetric];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.pageTitle}>BLOOD RESULT ANALYSIS</h2>
        <div className={styles.patientInfo}>
          Patient ID: {patientId || '-'} <span className={styles.divider}>|</span> Last Update: {latest?.test_date?.split('T')[0] || '-'}
        </div>
      </header>

      {/* 1. Summary Cards Section */}
      <div className={styles.cardsGrid}>
        {Object.entries(LAB_CONFIG).map(([key, conf]) => {
          // 데이터가 없으면 '-' 처리
          const value = latest ? (latest[key as keyof LabResult] as number) : undefined;
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
                  Ref: {conf.min ? `${conf.min} - ` : ''}{conf.max}
                </span>
                <span className={`${styles.badge} ${styles[status]}`}>
                  {status === 'normal' ? 'Normal' : 'Risk'}
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
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
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
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
              />
              {/* 기준선 표시 (Optional) */}
              {config.max && (
                <ReferenceLine y={config.max} stroke="#ef4444" strokeDasharray="3 3" />
              )}

              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, fill: 'white', stroke: '#3b82f6', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#3b82f6' }}
                animationDuration={500}
              />
            </LineChart>
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
        <h3 className={styles.sectionTitle}>Historical Test Results (Latest 10)</h3>
        <div className={styles.tableResponsive}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Test</th>
                <th>Result</th>
                <th>Reference Range</th>
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
                      <td className={styles.cellRef}>
                        {config.min ? `${config.min} - ` : ''}{config.max} {config.unit}
                      </td>
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
function getStatus(key: string, value?: number): 'normal' | 'danger' | 'warning' {
  if (value === undefined || value === null) return 'normal';
  const conf = LAB_CONFIG[key];
  if (conf.max && value > conf.max) return 'danger';
  if (conf.min && value < conf.min) return 'danger';
  return 'normal';
}