// src/pages/doctor/RNAResult.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import styles from './RNAResult.module.css';
import { getPatientGenomicData, type GenomicDataItem } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';

// 20개 Pathway 정의
const PATHWAY_KEYS = [
  "Myc Targets V1", "G2-M Checkpoint", "Glycolysis", "Spermatogenesis", "mTORC1 Signaling",
  "E2F Targets", "Unfolded Protein Response", "Mitotic Spindle", "Bile Acid Metabolism",
  "PI3K/AKT/mTOR Signaling", "KRAS Signaling Dn", "Myc Targets V2", "UV Response Up",
  "Xenobiotic Metabolism", "Coagulation", "Fatty Acid Metabolism", "Adipogenesis",
  "Reactive Oxygen Species Pathway", "DNA Repair", "Oxidative Phosphorylation"
];

export default function RNAResultPage() {
  // const { patientId: urlPatientId } = useParams<{ patientId: string }>();
  // const { selectedPatientId } = useTreatment();
  // const patientId = selectedPatientId || urlPatientId || '';
  // 개발 테스트를 위해 특정 환자 ID로 고정
  const { patientId: routePatientId } = useParams<{ patientId: string }>();
  const patientId = 'P20240009';

  const [dataList, setDataList] = useState<GenomicDataItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 선택된 날짜 인덱스
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(-1);

  const [hoveredCell, setHoveredCell] = useState<{
    pathway: string;
    date: string;
    score: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!patientId) {
      setDataList([]);
      return;
    }

    setLoading(true);
    // Genomic 데이터 조회
    getPatientGenomicData(patientId).then(response => {
      // 날짜순 정렬 (과거 -> 최신)
      const sorted = response.results
        .filter(d => d.measured_at)
        .slice()
        .sort((a, b) => new Date(a.measured_at!).getTime() - new Date(b.measured_at!).getTime());
      setDataList(sorted);
      // 데이터 로드 후, 가장 최신 날짜를 기본 선택
      setSelectedDateIndex(sorted.length ? sorted.length - 1 : -1);
    }).catch(err => {
      console.error(err);
      setDataList([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [patientId]);

  // 선택된 날짜의 데이터
  const selectedData = selectedDateIndex >= 0 && dataList[selectedDateIndex]
    ? dataList[selectedDateIndex]
    : undefined;

  // 1. Top Activated Pathways (Bar Chart용)
  // Bar Chart 데이터 - selectedData 기준
  const topActivatedData = useMemo(() => {
    if (!selectedData) return [];
    const pathwayScores = selectedData.pathway_scores;
    if (!pathwayScores || typeof pathwayScores !== 'object') return [];


    const scores = Object.entries(pathwayScores).map(([key, val]) => ({
      name: key,
      value: typeof val === 'number' ? val : 0,
      abs: Math.abs(typeof val === 'number' ? val : 0)
    }));

    // 절대값이 높은 순으로 정렬
    scores.sort((a, b) => b.abs - a.abs);

    // 20개 전체 반환
    return scores;
  }, [selectedData]);

  // Heatmap Cell 색상 결정 (Blue <-> White <-> Red)
  const getCellColor = (value: number) => {
    if (value === undefined || value === null) return '#f3f4f6';

    const limit = 2.0;
    // -limit ~ +limit 범위를 0 ~ 1로 정규화
    const normalized = (value + limit) / (2 * limit);
    const clamped = Math.min(Math.max(normalized, 0), 1);

    // 0: 파랑, 0.25: 하늘색, 0.5: 초록, 0.75: 노랑, 1: 빨강
    if (clamped < 0.25) {
      // 파랑 (#3b82f6) -> 하늘색 (#38bdf8)
      const t = clamped / 0.25;
      return interpolateColor('#3b82f6', '#38bdf8', t);
    } else if (clamped < 0.5) {
      // 하늘색 (#38bdf8) -> 초록 (#22c55e)
      const t = (clamped - 0.25) / 0.25;
      return interpolateColor('#38bdf8', '#22c55e', t);
    } else if (clamped < 0.75) {
      // 초록 (#22c55e) -> 노랑 (#eab308)
      const t = (clamped - 0.5) / 0.25;
      return interpolateColor('#22c55e', '#eab308', t);
    } else {
      // 노랑 (#eab308) -> 빨강 (#ef4444)
      const t = (clamped - 0.75) / 0.25;
      return interpolateColor('#eab308', '#ef4444', t);
    }
  };

  // 색상 보간 헬퍼 함수 (getCellColor 바로 위에 추가)
  const interpolateColor = (color1: string, color2: string, t: number): string => {
    const hex = (c: string) => parseInt(c.slice(1), 16);
    const r1 = (hex(color1) >> 16) & 255, g1 = (hex(color1) >> 8) & 255, b1 = hex(color1) & 255;
    const r2 = (hex(color2) >> 16) & 255, g2 = (hex(color2) >> 8) & 255, b2 = hex(color2) & 255;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.pageTitle}>유전체 경로 분석</h2>

        <div className={styles.searchbar}>
          <div className={styles.patientInfo}>
            Patient ID : {patientId || '-'}
            <span className={styles.divider}>|</span>
            Sample Date : {selectedData?.measured_at?.split('T')[0] || '-'}
          </div>

          {/* 날짜 목록 선택 드롭다운 */}
          <div className={styles.dateSelector}>
            <span className={styles.dateSelectorLabel}>날짜 선택:   </span>
            <select
              value={selectedDateIndex}
              onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
              className={styles.dateDropdown}
            >
              {dataList.map((data, idx) => (
                <option key={idx} value={idx}>
                  {data.measured_at?.split('T')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className={styles.dashboardGrid}>
        {/* Bar Chart Panel - selectedData 사용 */}
        <div className={styles.panel}>
          {/* 제목 영역 */}
          <div className={styles.panelTitleBlock}>
            <span className={styles.panelTitle}>활성화 경로</span>
            {/* 선택된 날짜 표시 */}
            <span className={styles.panelDate}>{selectedData?.measured_at?.split('T')[0] || ''}</span>
          </div>

          {/* 헤더 */}
          <div className={styles.pathwayListHeader}>
            <span>Pathway</span>
            <span>Score</span>
          </div>

          {/* 리스트 */}
          <div className={styles.pathwayList}>
            {topActivatedData.map((item, idx) => {
              // 바 색상: 히트맵 범위와 동일하게
              const limit = 2.0;
              const normalized = (item.value + limit) / (2 * limit);
              const clamped = Math.min(Math.max(normalized, 0), 1);
              let barColor = '#3b82f6'; // 기본 파랑
              if (clamped > 0.75) barColor = '#ef4444'; // 빨강
              else if (clamped > 0.5) barColor = '#eab308'; // 노랑
              else if (clamped > 0.25) barColor = '#22c55e'; // 초록
              else barColor = '#3b82f6'; // 파랑
              return (
                <div key={idx} className={styles.pathwayItem}>
                  <div className={styles.pathwayNameRow}>
                    <span className={styles.pathwayName}>{item.name}</span>
                    <span className={styles.pathwayScore} style={{ color: barColor }}>
                      {item.value.toFixed(0)}
                    </span>
                  </div>
                  <div className={styles.pathwayBarWrapper}>
                    <div
                      className={styles.pathwayBar}
                      style={{
                        width: `${Math.min(Math.abs(item.value) * 10, 100)}%`,
                        backgroundColor: barColor
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Heatmap Panel */}
        <div className={styles.panel}>
          <div className={styles.panelTitleBlock}>
            <span className={styles.panelTitle}>경로 발현 히트맵</span>
            <span className={styles.panelDate}>&nbsp;</span>
          </div>

          {dataList.length === 0 ? (
            <div className={styles.emptyText}>
              {loading ? 'Loading history...' : 'No history data to display heatmap'}
            </div>
          ) : (
            <div className={styles.heatmapWrapper} style={{ overflow: 'hidden' }}>
              {/* 
                   Grid Template:
                   첫 번째 컬럼(라벨): 180px
                   나머지 컬럼(데이터): 데이터 개수만큼 100px씩 고정 (너무 넓어지는 것 방지)
                */}
              <div
                className={styles.heatmapGrid}
                style={{
                  gridTemplateColumns: `220px repeat(${dataList.length}, 1fr)`
                }}
              >
                {/* Header Row (Dates) */}
                <div className={styles.heatmapHeaderCell}></div>
                {dataList.map((data, idx) => (
                  <div key={idx} className={styles.heatmapHeaderCell}>
                    {data.measured_at?.split('T')[0]}
                  </div>
                ))}

                {/* Data Rows (Pathways) */}
                {PATHWAY_KEYS.map((pathway) => (
                  <React.Fragment key={pathway}>
                    <div className={styles.heatmapRowLabel} title={pathway}>{pathway}</div>
                    {dataList.map((data, idx) => {
                      const score = data.pathway_scores ? (data.pathway_scores as Record<string, number>)[pathway] : 0;
                      return (
                        <div
                          key={`${pathway}-${idx}`}
                          className={styles.heatmapCell}
                          style={{ backgroundColor: getCellColor(score) }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              pathway,
                              date: data.measured_at?.split('T')[0] || data.sample_date || '-',
                              score: score ?? 0,
                              x: Math.min(rect.left + rect.width / 2, window.innerWidth - 100),
                              y: rect.top - 10
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              <div className={styles.legend} style={{ marginLeft: '220px' }}>
                <div className={styles.legendGradient}></div>
              </div>
              <div className={styles.legendLabels} style={{ marginLeft: '220px' }}>
                <span>발현 억제 (Blue)</span>
                <span>발현 활성 (Red)</span>
              </div>
              {/* 툴팁 */}
              {hoveredCell && (
                <div style={{
                  position: 'fixed',
                  left: hoveredCell.x,
                  top: hoveredCell.y,
                  transform: 'translate(-50%, -100%)',
                  background: '#1f2937',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{ fontWeight: 600, color: hoveredCell.score > 0 ? '#f87171' : '#60a5fa' }}>
                    {hoveredCell.pathway}
                  </div>
                  <div>Date: {hoveredCell.date}</div>
                  <div>Score: {hoveredCell.score.toFixed(3)}</div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Data Table - 날짜별 컬럼 형태 */}
      <div className={styles.tableSection}>
        <h3 className={styles.panelTitle}>경로 상태 종합 분석</h3>
        <div className={styles.tableResponsive}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', minWidth: '200px' }}>Pathway Name</th>
                {dataList.map((data, idx) => (
                  <th key={idx} style={{ textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {data.measured_at?.split('T')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataList.length === 0 ? (
                <tr>
                  <td colSpan={dataList.length + 1} className={styles.emptyText}>
                    {loading ? 'Loading...' : 'No data available'}
                  </td>
                </tr>
              ) : (
                PATHWAY_KEYS.map((pathway) => (
                  <tr key={pathway}>
                    <td style={{ fontWeight: '500' }}>{pathway}</td>
                    {dataList.map((data, idx) => {
                      const score = data.pathway_scores ? (data.pathway_scores as Record<string, number>)[pathway] : 0;
                      // Status 결정
                      let status: 'activated' | 'neutral' | 'suppressed' = 'neutral';
                      let bgColor = '#f3f4f6'; // 회색 (Neutral)
                      let textColor = '#6b7280';

                      if (score > 0.5) {
                        status = 'activated';
                        bgColor = '#fee2e2'; // 연한 빨강
                        textColor = '#dc2626';
                      } else if (score < -0.5) {
                        status = 'suppressed';
                        bgColor = '#dbeafe'; // 연한 파랑
                        textColor = '#2563eb';
                      }

                      return (
                        <td key={idx} style={{ textAlign: 'center', padding: '6px 4px' }}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: '500',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: bgColor,
                            color: textColor
                          }}>
                            {score?.toFixed(2) ?? '-'}
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
    </div >
  );
}
