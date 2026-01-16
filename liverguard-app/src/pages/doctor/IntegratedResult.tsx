// src/pages/doctor/IntegratedResult.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceArea
} from 'recharts';
import styles from './BloodResult.module.css';
import { getPatientLabResults, getPatientGenomicData, type LabResult, type GenomicDataItem } from '../../api/doctorApi';

// 1. 검사 지표 설정 (단위 및 정상 범위)
const LAB_CONFIG: Record<string, { label: string; unit: string; min?: number; max?: number }> = {
    afp: { label: 'AFP', unit: 'ng/mL', max: 7 },
    albumin: { label: 'Albumin', unit: 'g/dL', min: 3.5, max: 5.5 },
    bilirubin_total: { label: 'Bilirubin', unit: 'mg/dL', max: 1.2 },
    platelet: { label: 'Platelet', unit: '10^3/uL', min: 150, max: 450 },
    pt_inr: { label: 'PT (INR)', unit: '', min: 0.8, max: 1.2 },
    creatinine: { label: 'Creatinine', unit: 'mg/dL', min: 0.6, max: 1.2 },
    child_pugh_class: { label: 'Child-Pugh', unit: '', max: 6 },
    meld_score: { label: 'MELD', unit: 'pts', max: 20 },
    albi_score: { label: 'ALBI Score', unit: 'pts', max: -1.39 },
    albi_grade: { label: 'ALBI Grade', unit: 'Gr', max: 3 }
};

export default function IntegratedResultPage() {
    // const { patientId: urlPatientId } = useParams<{ patientId: string }>();
    // const { selectedPatientId } = useTreatment();
    // const patientId = selectedPatientId || urlPatientId || '';
    // 개발 테스트를 위해 특정 환자 ID로 고정
    const { patientId: routePatientId } = useParams<{ patientId: string }>();
    const patientId = 'P20240009';

    const [results, setResults] = useState<LabResult[]>([]);
    const [genomicData, setGenomicData] = useState<GenomicDataItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDateIndex, setSelectedDateIndex] = useState<number>(-1);

    useEffect(() => {
        if (!patientId) return;
        setLoading(true);
        Promise.all([
            getPatientLabResults(patientId),
            getPatientGenomicData(patientId)
        ]).then(([labData, genomicRes]) => {
            const uniqueLabMap = new Map<string, LabResult>();
            labData.results.forEach(item => {
                const date = (item.test_date || item.measured_at || '').split('T')[0];
                if (!date) return;
                const existing = uniqueLabMap.get(date);
                if (!existing || (item.platelet || 0) > (existing.platelet || 0)) uniqueLabMap.set(date, item);
            });

            const sortedLab = Array.from(uniqueLabMap.values())
                .sort((a, b) => new Date(a.measured_at || a.test_date).getTime() - new Date(b.measured_at || b.test_date).getTime());

            setResults(sortedLab);
            if (sortedLab.length > 0) setSelectedDateIndex(sortedLab.length - 1);
            if (genomicRes?.results) setGenomicData(genomicRes.results);
        }).finally(() => setLoading(false));
    }, [patientId]);

    const selectedLab = selectedDateIndex >= 0 ? results[selectedDateIndex] : undefined;
    const currentDate = (selectedLab?.test_date || '').split('T')[0];
    const matchedGenomic = useMemo(() => genomicData.find(g => g.measured_at?.startsWith(currentDate)), [genomicData, currentDate]);

    // 유전체 Top 3 계산 (양수=활성, 음수=억제)
    const top3Activated = useMemo(() => {
        if (!matchedGenomic?.pathway_scores) return [];
        return Object.entries(matchedGenomic.pathway_scores)
            .filter(([, s]) => (s as number) > 0)
            .map(([name, score]) => ({ name, score: score as number }))
            .sort((a, b) => b.score - a.score).slice(0, 3);
    }, [matchedGenomic]);

    const top3Suppressed = useMemo(() => {
        if (!matchedGenomic?.pathway_scores) return [];
        return Object.entries(matchedGenomic.pathway_scores)
            .filter(([, s]) => (s as number) < 0)
            .map(([name, score]) => ({ name, score: score as number }))
            .sort((a, b) => a.score - b.score).slice(0, 3);
    }, [matchedGenomic]);

    const chartData = Object.entries(LAB_CONFIG).map(([key, conf]) => {
        const rawVal = selectedLab?.[key as keyof LabResult];
        let numVal = typeof rawVal === 'string' ? (rawVal === 'A' ? 1 : rawVal === 'B' ? 2 : rawVal === 'C' ? 3 : 0) : Number(rawVal || 0);

        // Platelet만 단위 조정 (/10)
        const displayValue = rawVal ?? '-';
        if (key === 'platelet') {
            numVal = numVal / 10;
        }

        const isWarning = (conf.max !== undefined && Number(rawVal || 0) > conf.max) || (conf.min !== undefined && Number(rawVal || 0) < conf.min);
        return { name: conf.label, value: numVal, displayValue, isWarning };
    });

    return (
        <div className={styles.container} style={{ padding: '20px', backgroundColor: '#f4f7fa' }}>
            {/* 상단 헤더: 환자 ID 및 날짜 선택 */}
            <header className={styles.header} style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#334155' }}>
                    Patient ID: <span style={{ color: '#2563eb' }}>{patientId}</span>
                    <span style={{ margin: '0 15px', color: '#e2e8f0' }}>|</span>
                    Date: <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{currentDate || '-'}</span>
                </div>
                <select
                    value={selectedDateIndex}
                    onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                    {[...results].reverse().map((r, idx) => (
                        <option key={idx} value={results.length - 1 - idx}>{r.test_date.split('T')[0]}</option>
                    ))}
                </select>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(350px, 1fr)', gap: '24px' }}>

                {/* 왼쪽: 혈액 검사 */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>🩸 혈액 검사 결과 요약</h3>

                    {/* 1. 수치 요약 표 */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '50px', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                                <th style={{ padding: '10px' }}>검사항목</th>
                                <th style={{ padding: '10px' }}>결과값</th>
                                <th style={{ padding: '10px' }}>정상범위</th>
                                <th style={{ padding: '10px', textAlign: 'center' }}>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(LAB_CONFIG).map(([key, conf]) => {
                                const val = selectedLab?.[key as keyof LabResult] as number;
                                // 정상 범위 체크 (max 초과 or min 미만이면 Warning)
                                const isWarning = (conf.max !== undefined && val > conf.max) || (conf.min !== undefined && val < conf.min);
                                return (
                                    <tr key={key} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '10px', fontWeight: '500', color: '#334155' }}>{conf.label}</td>
                                        <td style={{ padding: '10px', fontWeight: 'bold', color: isWarning ? '#ef4444' : '#10b981' }}>
                                            {val !== undefined ? val : '-'}
                                            <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#94a3b8', marginLeft: '4px' }}>{conf.unit}</span>
                                        </td>
                                        <td style={{ padding: '10px', color: '#64748b' }}>
                                            {conf.min ?? 0} ~ {conf.max ?? '-'}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                                                background: isWarning ? '#fee2e2' : '#dcfce7',
                                                color: isWarning ? '#b91c1c' : '#15803d'
                                            }}>
                                                {isWarning ? '주의' : '정상'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* 2. 지표별 개별 막대 그래프 그리드 */}
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', marginBottom: '15px' }}>지표별 상세 그래프</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px' }}>
                        {Object.entries(LAB_CONFIG).map(([key, conf]) => {
                            const val = (selectedLab?.[key as keyof LabResult] as number) || 0;
                            // Y축 자동 스케일링: 값과 Max 중 큰 것의 1.2배 ~ 1.5배로 여유 있게 잡음
                            const safeMax = conf.max || 100;
                            const chartMax = Math.max(val, safeMax) * 1.3;
                            const isWarning = (conf.max !== undefined && val > conf.max) || (conf.min !== undefined && val < conf.min);

                            return (
                                <div key={key} style={{ height: '160px', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '12px', background: '#fafafa' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {conf.label}
                                    </div>
                                    <ResponsiveContainer width="100%" height="70%">
                                        <BarChart data={[{ value: val }]} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <YAxis domain={[0, chartMax]} tick={{ fontSize: 9 }} width={30} />
                                            <XAxis hide />
                                            {/* 정상 범위(Safe Zone)를 녹색 배경으로 표시 */}
                                            <ReferenceArea y1={conf.min || 0} y2={conf.max} fill="#22c55e" fillOpacity={0.15} />
                                            <Bar dataKey="value" barSize={24} radius={[4, 4, 0, 0]}>
                                                <Cell fill={isWarning ? '#ef4444' : '#10b981'} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div style={{ fontSize: '13px', textAlign: 'center', fontWeight: 'bold', marginTop: '4px', color: isWarning ? '#ef4444' : '#10b981' }}>
                                        {val}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* [오른쪽 패널] 유전체 분석 결과: 전체 표 + Top 3 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* 1. 전체 유전체 경로 점수 표 */}
                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flex: 1, minHeight: '300px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '18px', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>🧬 전체 유전체 경로 분석</h3>

                        <div style={{ height: '500px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                                    <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                                        <th style={{ padding: '12px', color: '#475569' }}>Pathway Name</th>
                                        <th style={{ padding: '12px', color: '#475569', textAlign: 'right' }}>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!matchedGenomic ? (
                                        <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>데이터 없음</td></tr>
                                    ) : (
                                        // 점수 절대값 순으로 정렬해서 보여주기
                                        Object.entries(matchedGenomic.pathway_scores || {})
                                            .sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))
                                            .map(([name, score]) => (
                                                <tr key={name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '10px 12px', color: '#334155' }}>{name}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: (score as number) > 0 ? '#dc2626' : '#2563eb' }}>
                                                        {(score as number).toFixed(3)}
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 오른쪽: 유전체 활성/억제 Top 3 */}
                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        {matchedGenomic ? (
                            <div style={{ display: 'flex', gap: '30px' }}>
                                {/* 활성화 Top 3 */}
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#dc2626' }}>🔺 활성화 Top 3</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {top3Activated.map((item, idx) => (
                                            <div key={idx} style={{ padding: '12px', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>{idx + 1}. {item.name}</div>
                                                <span style={{ fontSize: '12px', color: '#dc2626' }}>Score: {item.score.toFixed(3)}</span>
                                            </div>
                                        ))}
                                        {top3Activated.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px' }}>활성화된 경로 없음</div>}
                                    </div>
                                </div>
                                {/* 억제 Top 3 */}
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#2563eb' }}>🔻 억제 Top 3</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {top3Suppressed.map((item, idx) => (
                                            <div key={idx} style={{ padding: '12px', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>{idx + 1}. {item.name}</div>
                                                <span style={{ fontSize: '12px', color: '#2563eb' }}>Score: {item.score.toFixed(3)}</span>
                                            </div>
                                        ))}
                                        {top3Suppressed.length === 0 && <div style={{ color: '#94a3b8', fontSize: '12px' }}>억제된 경로 없음</div>}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>해당 날짜의 유전체 데이터 없음</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 하단: AI 리포트 Placeholder */}
            <div style={{ marginTop: '24px', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#1e293b' }}>AI 종합 분석 리포트</h3>
                <div style={{ padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>🚀</div>
                    <p style={{ fontSize: '16px', fontWeight: '500', color: '#334155' }}>LLM API 연동 예정</p>
                    <p style={{ marginTop: '8px', fontSize: '14px', color: '#64748b' }}>
                        혈액 검사 데이터와 유전체 변이 패턴을 종합 분석하여,<br />
                        환자 상태에 대한 심층적인 임상 해석과 치료 권고안을 여기에 생성합니다.
                    </p>
                </div>
            </div>
        </div>
    );
}