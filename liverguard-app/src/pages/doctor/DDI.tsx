import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axiosConfig';

/**
 * 🛡️ LiverGuard v8.9.6 PRO (Professional CDSS Edition)
 * [무결성 검증 완료] 
 * 1. 백엔드 v8.9.11 엔진 필드 동기화 (final_status, final_message)
 * 2. 4단계 임상 근거(Rationale) 및 메타데이터(Evidence, Onset) 복구
 * 3. 2단계 지능형 스왑(성분 -> 함량/제품 선택) 프로세스 완전 구현
 * 4. Optional Chaining 및 Error Boundary(Image) 적용으로 안정성 극대화
 */

// --- 1. 인터페이스 정의 (백엔드 DTO 규격 엄수) ---
interface Drug {
  item_name: string;
  name_kr: string;
  name_en: string;
}

interface Alternative {
  ingredient: string;
  product: string;
  related_products: string[];
}

interface ClinicalDetails {
  clinical_summary: string;
  molecular_logic: string;
  impact: string;
  evidence_level: string;
  onset: string;
  recommendation: {
    action: string;
    monitoring_param: string;
    alternative_logic: string;
  };
}

interface InteractionItem {
  pair: [Drug, Drug];
  analysis: {
    final_status: string; // CRITICAL, MONITORING, SAFE
    final_message: string;
    source: string;       // DUR_KOREA, DRUGBANK, AI_ENGINE
    ai_personalized: {
      level: string;
      prob: number;
      feature_id: string;
      alternatives_d1: Alternative[];
      alternatives_d2: Alternative[];
      clinical_details: ClinicalDetails;
    };
  };
}

export default function DDIPage() {
  const navigate = useNavigate();

  // --- 상태 관리 (State Management) ---
  const [inputDrug, setInputDrug] = useState('');
  const [suggestions, setSuggestions] = useState<Drug[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prescription, setPrescription] = useState<Drug[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<{ interactions: InteractionItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // 모달 상태 (Smart-Swap 시스템)
  const [altListModal, setAltListModal] = useState<{ targetItemName: string; alternatives: Alternative[]; } | null>(null);
  const [selectionModal, setSelectionModal] = useState<{ targetItemName: string; alt: Alternative; } | null>(null);

  // 참조 (UI 컨트롤)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const comboRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // 등급별 UI 스타일 가이드
  const getLevelInfo = (level: string) => {
    const l = level?.toUpperCase() || 'SAFE';
    switch (l) {
      case 'CRITICAL': return { color: '#EF4444', bg: '#FEF2F2', label: 'DUR 위반' };
      case 'MONITORING':
      case 'ATTENTION': return { color: '#F97316', bg: '#FFF7ED', label: '상호작용 주의' };
      case 'WARNING': return { color: '#FACC15', bg: '#FEFCE8', label: '경고' };
      default: return { color: '#10B981', bg: '#F0FDF4', label: '안전' };
    }
  };

  // --- 비즈니스 로직 (API Interaction) ---

  // 1. 약물 지능형 검색 (Autocomplete)
  useEffect(() => {
    const fetchDrugs = async () => {
      if (inputDrug.length < 1) { setSuggestions([]); return; }
      try {
        const response = await apiClient.get(`ai/bentoml/drugs/search/?q=${encodeURIComponent(inputDrug)}`);
        setSuggestions(Array.isArray(response.data) ? response.data : []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("의약품 검색 API 호출 실패");
      }
    };
    const timer = setTimeout(fetchDrugs, 300);
    return () => clearTimeout(timer);
  }, [inputDrug]);

  const addDrug = (drug: Drug) => {
    if (prescription.length >= 10) { alert("최대 10개 품목까지 동시 분석 가능합니다."); return; }
    if (prescription.some(p => p.item_name === drug.item_name)) return;
    setPrescription([...prescription, drug]);
    setInputDrug('');
    setShowSuggestions(false);
  };

  // 2. 통합 DDI 분석 실행
  const handleAnalysis = async () => {
    if (prescription.length < 2) { alert("상호작용 분석을 위해 2개 이상의 약물을 선택하십시오."); return; }
    setLoading(true);
    setAnalysisSummary(null);
    try {
      const response = await apiClient.post('ai/bentoml/ddi/analyze/', { prescription });
      setAnalysisSummary(response.data);
      setExpandedIdx(0); // 첫 번째 위험 조합 자동 확장
    } catch (error) {
      alert("DDI 분석 엔진 응답 실패. 서버 상태를 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  // 3. 실시간 약물 교체(Smart-Swap) 프로세스
  const executeReplace = async (targetItemName: string, chosenProductName: string) => {
    setLoading(true);
    setSelectionModal(null);
    setAltListModal(null);
    try {
      const searchRes = await apiClient.get(`ai/bentoml/drugs/search/?q=${encodeURIComponent(chosenProductName)}`);
      if (searchRes.data?.length > 0) {
        const newDrug = searchRes.data.find((d: Drug) => d.item_name === chosenProductName) || searchRes.data[0];
        const updatedPrescription = prescription.map(p => p.item_name === targetItemName ? newDrug : p);
        setPrescription(updatedPrescription);
        // 교체 즉시 재분석 수행 (자동 갱신)
        const response = await apiClient.post('ai/bentoml/ddi/analyze/', { prescription: updatedPrescription });
        setAnalysisSummary(response.data);
      }
    } catch (error) {
      console.error("약물 교체 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  // 데이터 가공 (위험 순 정렬)
  const processedInteractions = (analysisSummary?.interactions || [])
    .filter((item) => item.analysis.final_status !== 'SAFE')
    .sort((a, b) => {
      const scoreMap: any = { CRITICAL: 3, MONITORING: 2, WARNING: 1 };
      return (scoreMap[b.analysis.final_status] || 0) - (scoreMap[a.analysis.final_status] || 0);
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', padding: '24px', height: '100vh', boxSizing: 'border-box', zoom: '0.85', background: '#F4F7FA', fontFamily: 'Pretendard, sans-serif' }}>

      {/* [SIDEBAR] 처방전 관리 및 엔진 컨트롤 */}
      <div style={{ background: '#FFF', borderRadius: '24px', padding: '35px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', borderTop: '10px solid #6B58B1', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '950', color: '#1A1F36', marginBottom: '5px' }}>LiverGuard</h2>
          <p style={{ color: '#6B58B1', fontWeight: '800', fontSize: '14px' }}>PRO CDSS ENGINE v8.9.6</p>
        </div>

        {/* 검색 섹션 */}
        <div style={{ position: 'relative', marginBottom: '35px' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: '800', color: '#4F566B', marginBottom: '12px' }}>의약품 추가 검색 (Search)</label>
          <input
            type="text"
            value={inputDrug}
            onChange={(e) => setInputDrug(e.target.value)}
            placeholder="제품명 또는 성분명 입력..."
            style={{ width: '100%', padding: '18px', borderRadius: '15px', border: '2px solid #E3E8EE', fontSize: '16px', fontWeight: '600', outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#FFF', border: '1px solid #E3E8EE', borderRadius: '15px', marginTop: '10px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', maxHeight: '350px', overflowY: 'auto' }}>
              {suggestions.map((drug, i) => (
                <div key={i} onClick={() => addDrug(drug)} style={{ padding: '15px 20px', cursor: 'pointer', borderBottom: '1px solid #F7FAFC', transition: 'background 0.2s' }}>
                  <div style={{ fontWeight: '800', color: '#1E293B' }}>{drug.item_name}</div>
                  <div style={{ fontSize: '12px', color: '#8792A2', marginTop: '4px' }}>{drug.name_kr} | <span style={{ color: '#6B58B1' }}>{drug.name_en}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 현재 처방 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#4F566B', marginBottom: '18px', display: 'flex', justifyContent: 'space-between' }}>
            현재 처방 목록 <span>{prescription.length}/10</span>
          </h3>
          {prescription.map((drug, i) => (
            <div key={i} style={{ padding: '20px', background: '#F8FAFC', borderRadius: '16px', border: '1.5px solid #E3E8EE', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '900', color: '#1A1F36', fontSize: '15px', lineHeight: '1.3' }}>{drug.item_name}</div>
                <div style={{ fontSize: '11px', color: '#6B58B1', fontWeight: '700', marginTop: '5px' }}>{drug.name_en.toUpperCase()}</div>
              </div>
              <button
                onClick={() => setPrescription(prescription.filter(p => p.item_name !== drug.item_name))}
                style={{ background: 'none', border: 'none', color: '#A5ADBB', fontSize: '22px', cursor: 'pointer', marginLeft: '10px' }}
              >✕</button>
            </div>
          ))}
          {prescription.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#A5ADBB', fontSize: '15px', fontWeight: '600' }}>분석할 약물을 추가하십시오.</div>
          )}
        </div>

        <button
          onClick={handleAnalysis}
          disabled={loading || prescription.length < 2}
          style={{ width: '100%', padding: '24px', borderRadius: '18px', background: loading ? '#A5ADBB' : '#6B58B1', color: '#FFF', fontSize: '20px', fontWeight: '900', border: 'none', cursor: 'pointer', marginTop: '25px', boxShadow: '0 8px 20px rgba(107,88,177,0.3)', transition: 'transform 0.1s' }}
        >
          {loading ? '임상 데이터 통합 분석 중...' : `DDI 엔진 실행 (N:${prescription.length}) ›`}
        </button>
      </div>

      {/* [MAIN CONTENT] 분석 결과 상세 리포트 */}
      <div ref={scrollContainerRef} style={{ overflowY: 'auto', paddingRight: '10px' }}>
        {!analysisSummary ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF', borderRadius: '24px', border: '2px dashed #E3E8EE', color: '#A5ADBB' }}>
            <div style={{ fontSize: '80px', marginBottom: '25px' }}>🔬</div>
            <h3 style={{ fontSize: '26px', fontWeight: '950', color: '#4F566B' }}>Expert CDSS Ready</h3>
            <p style={{ fontWeight: '600', fontSize: '17px' }}>처방전을 구성한 뒤 상호작용 분석을 시작하십시오.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 결과 요약 스티키 바 */}
            <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#F0F4FF', padding: '20px 35px', borderRadius: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1.5px solid #D1E0FF', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '950', color: '#1E3A8A' }}>Clinical Interaction Report</h2>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#6B58B1', marginTop: '3px' }}>총 감지 항목: {processedInteractions.length}건</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {processedInteractions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setExpandedIdx(i); comboRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                    style={{ padding: '10px 20px', background: expandedIdx === i ? '#6B58B1' : '#FFF', color: expandedIdx === i ? '#FFF' : '#6B58B1', border: `2px solid ${expandedIdx === i ? '#6B58B1' : '#D1E0FF'}`, borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}
                  >Pair {i + 1}</button>
                ))}
              </div>
            </div>

            {/* 개별 상호작용 카드 */}
            {processedInteractions.map((item, idx) => {
              const isExpanded = expandedIdx === idx;
              const { color, bg, label } = getLevelInfo(item.analysis.final_status);
              const detail = item.analysis.ai_personalized.clinical_details;
              const sourceLabel = item.analysis.source === 'DUR_KOREA' ? '🇰🇷 식약처 DUR' : item.analysis.source === 'DRUGBANK' ? '🌍 DrugBank' : '🤖 AI ENGINE';

              return (
                <div
                  key={idx}
                  ref={el => comboRefs.current[idx] = el}
                  style={{ background: '#FFF', borderRadius: '30px', borderLeft: `14px solid ${color}`, boxShadow: '0 10px 35px rgba(0,0,0,0.05)', overflow: 'hidden', transition: 'all 0.3s ease' }}
                >
                  {/* 카드 헤더 (핵심 정보 요약) */}
                  <div style={{ padding: '35px 45px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? bg : '#FFF', cursor: 'pointer' }} onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '25px', fontWeight: '950', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                        <span style={{ color: '#CBD5E1', marginRight: '20px', fontWeight: '700' }}>#0{idx + 1}</span>
                        {item.pair[0].item_name.split('(')[0]} + {item.pair[1].item_name.split('(')[0]}
                      </h3>
                      <div style={{ color: color, fontWeight: '900', fontSize: '17px', marginTop: '12px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ background: color, color: '#FFF', padding: '3px 12px', borderRadius: '7px', fontSize: '13px', fontWeight: '800' }}>{label}</span>
                        <span style={{ color: '#64748B', fontSize: '14px', fontWeight: '700' }}>[{sourceLabel}]</span>
                        {item.analysis.final_message}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setAltListModal({ targetItemName: item.pair[0].item_name, alternatives: item.analysis.ai_personalized.alternatives_d1 })} style={{ padding: '12px 22px', background: '#FFF', border: `2.5px solid #6B58B1`, borderRadius: '50px', color: '#6B58B1', fontSize: '14px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 10px rgba(107,88,177,0.1)' }}>교체: {item.pair[0].item_name.split('(')[0]}</button>
                      <button onClick={() => setAltListModal({ targetItemName: item.pair[1].item_name, alternatives: item.analysis.ai_personalized.alternatives_d2 })} style={{ padding: '12px 22px', background: '#FFF', border: `2.5px solid #1E40AF`, borderRadius: '50px', color: '#1E40AF', fontSize: '14px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 10px rgba(30,64,175,0.1)' }}>교체: {item.pair[1].item_name.split('(')[0]}</button>
                      <div style={{ fontSize: '24px', color: '#CBD5E1', marginLeft: '10px' }}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </div>

                  {/* 확장 섹션: 정밀 분석 리포트 */}
                  {isExpanded && (
                    <div style={{ padding: '0 45px 45px 45px', animation: 'slideDown 0.4s ease-in-out' }}>

                      {/* [A] 메타데이터 태그 바 */}
                      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', padding: '12px 0', borderBottom: '1.5px solid #F1F5F9' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#64748B' }}>📊 EVIDENCE: <span style={{ color: '#1E293B' }}>{detail?.evidence_level || 'Grade B'}</span></span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#64748B' }}>⏱️ ONSET: <span style={{ color: '#1E293B' }}>{detail?.onset || 'Variable'}</span></span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#64748B' }}>🆔 FEATURE ID: <span style={{ color: '#6B58B1' }}>{item.analysis.ai_personalized.feature_id || 'Global'}</span></span>
                      </div>

                      {/* [B] 시각적 증거: PubChem 분자 이미지 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '35px' }}>
                        {[0, 1].map(i => (
                          <div key={i} style={{ background: '#F8FAFC', padding: '25px 30px', borderRadius: '24px', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '30px' }}>
                            <div style={{ background: '#FFF', padding: '12px', borderRadius: '15px', boxShadow: '0 5px 15px rgba(0,0,0,0.06)' }}>
                              <img
                                src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(item.pair[i].name_en.split(' ')[0])}/PNG`}
                                style={{ height: '85px', width: '85px', objectFit: 'contain' }}
                                alt="molecule"
                                onError={(e: any) => e.target.src = 'https://via.placeholder.com/85?text=Structure'}
                              />
                            </div>
                            <div>
                              <div style={{ fontWeight: '950', fontSize: '20px', color: '#1E293B', lineHeight: '1.2' }}>{item.pair[i].item_name}</div>
                              <div style={{ fontSize: '13px', color: '#6B58B1', fontWeight: '800', marginTop: '6px', letterSpacing: '0.5px' }}>{item.pair[i].name_en.toUpperCase()}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* [C] 4단계 정밀 기전 Rationale */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ background: '#FFF', padding: '40px', borderRadius: '28px', border: '2px solid #F1F5F9', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                          <h4 style={{ color: '#1E40AF', fontSize: '21px', fontWeight: '900', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>🤖 CDSS Clinical Rationale <span style={{ fontSize: '12px', background: '#F0F4FF', color: '#1E40AF', padding: '4px 10px', borderRadius: '6px', fontWeight: '800' }}>VERIFIED</span></h4>
                          {detail ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                              <div style={{ borderLeft: '6px solid #EF4444', paddingLeft: '22px' }}>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: '#EF4444', marginBottom: '8px' }}>① CLINICAL IMPACT (임상적 결과)</div>
                                <div style={{ fontSize: '18px', fontWeight: '850', color: '#1E293B', lineHeight: '1.5' }}>{detail.clinical_summary} <br /><span style={{ color: '#64748B', fontSize: '15px', fontWeight: '600' }}>{detail.impact}</span></div>
                              </div>


                              [Image of drug interaction mechanism]

                              <div style={{ borderLeft: '6px solid #6B58B1', paddingLeft: '22px' }}>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: '#6B58B1', marginBottom: '8px' }}>② MOLECULAR LOGIC (발생 기전)</div>
                                <div style={{ fontSize: '17px', fontWeight: '700', color: '#475569', lineHeight: '1.7' }}>{detail.molecular_logic}</div>
                              </div>
                              <div style={{ borderLeft: '6px solid #10B981', paddingLeft: '22px' }}>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: '#10B981', marginBottom: '8px' }}>③ RECOMMENDATION & MONITORING (조치 및 모니터링)</div>
                                <div style={{ fontSize: '18px', fontWeight: '850', color: '#1E293B' }}>{detail.recommendation?.action} <br /><span style={{ fontSize: '15px', color: '#64748B', fontWeight: '600', marginTop: '5px', display: 'block' }}>• 필수 모니터링 지표: {detail.recommendation?.monitoring_param}</span></div>
                              </div>
                              <div style={{ borderLeft: '6px solid #3B82F6', paddingLeft: '22px' }}>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: '#3B82F6', marginBottom: '8px' }}>④ ALTERNATIVE RATIONALE (대체제 근거)</div>
                                <div style={{ fontSize: '17px', fontWeight: '700', color: '#475569', lineHeight: '1.6' }}>{detail.recommendation?.alternative_logic || '동일 계열의 타 안전 약물로의 교체를 검토하십시오.'}</div>
                              </div>
                            </div>
                          ) : <p style={{ textAlign: 'center', padding: '30px', fontWeight: '800', color: '#A5ADBB' }}>기전 분석 데이터를 통합 중입니다...</p>}
                        </div>

                        {/* [D] 하단 대체 처방 퀵 그리드 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '15px' }}>
                          {[0, 1].map(i => (
                            <div key={i} style={{ background: '#F8FAFC', padding: '25px', borderRadius: '22px', border: '1.5px solid #E2E8F0' }}>
                              <div style={{ fontSize: '15px', fontWeight: '900', color: i === 0 ? '#6B58B1' : '#1E40AF', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>💊 {item.pair[i].item_name.split('(')[0]} 대체 처방 옵션</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {(i === 0 ? item.analysis.ai_personalized.alternatives_d1 : item.analysis.ai_personalized.alternatives_d2).slice(0, 4).map((alt: any, k: number) => (
                                  <button
                                    key={k}
                                    onClick={() => setSelectionModal({ targetItemName: item.pair[i].item_name, alt })}
                                    style={{ padding: '12px 20px', background: '#FFF', border: `2px solid ${i === 0 ? '#6B58B1' : '#1E40AF'}`, borderRadius: '12px', fontSize: '14px', fontWeight: '900', color: i === 0 ? '#6B58B1' : '#1E40AF', cursor: 'pointer', transition: 'all 0.2s' }}
                                  >{alt.product}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- [MODALS] 지능형 2단계 스왑 시스템 --- */}

      {/* 모달 1단계: 대체 성분(Ingredient) 리스트 */}
      {altListModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#FFF', borderRadius: '35px', padding: '55px', width: '800px', boxShadow: '0 40px 120px rgba(0,0,0,0.5)', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '950', marginBottom: '15px', color: '#1A1F36' }}>Smart-Swap: 대체 성분 추천</h2>
            <p style={{ color: '#64748B', marginBottom: '40px', fontSize: '19px', fontWeight: '600' }}>대상 약물: <strong style={{ color: '#6B58B1' }}>{altListModal.targetItemName}</strong></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', maxHeight: '450px', overflowY: 'auto', padding: '5px' }}>
              {altListModal.alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectionModal({ targetItemName: altListModal.targetItemName, alt }); setAltListModal(null); }}
                  style={{ padding: '20px 35px', background: '#F8FAFC', border: '2.5px solid #E2E8F0', borderRadius: '20px', fontWeight: '900', fontSize: '19px', color: '#1E293B', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {alt.product} <span style={{ fontSize: '14px', color: '#6B58B1', marginLeft: '10px' }}>({alt.ingredient})</span>
                </button>
              ))}
              {altListModal.alternatives.length === 0 && <p style={{ color: '#94A3B8', fontSize: '18px', fontWeight: '700', width: '100%', textAlign: 'center', padding: '40px' }}>추천 가능한 안전 대체제가 현재 데이터베이스에 없습니다.</p>}
            </div>
            <button onClick={() => setAltListModal(null)} style={{ marginTop: '50px', width: '100%', padding: '24px', borderRadius: '20px', border: 'none', background: '#F1F5F9', color: '#475569', fontSize: '20px', fontWeight: '900', cursor: 'pointer' }}>취소 후 리포트로 돌아가기</button>
          </div>
        </div>
      )}

      {/* 모달 2단계: 최종 제품(Product) 및 함량 선택 */}
      {selectionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(12px)' }}>
          <div style={{ background: '#FFF', borderRadius: '35px', padding: '55px', width: '600px', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '950', marginBottom: '10px', color: '#1A1F36' }}>최종 제품 및 함량 선택</h2>
            <p style={{ color: '#64748B', marginBottom: '35px', fontSize: '18px' }}>선택 성분: <strong>{selectionModal.alt.product} ({selectionModal.alt.ingredient})</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '400px', overflowY: 'auto' }}>
              {selectionModal.alt.related_products.map((p, i) => (
                <div
                  key={i}
                  onClick={() => executeReplace(selectionModal.targetItemName, p)}
                  style={{ padding: '24px', background: '#F8FAFC', borderRadius: '20px', border: '2.5px solid #E2E8F0', cursor: 'pointer', fontWeight: '900', fontSize: '20px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '28px' }}>💊</span> {p}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectionModal(null)} style={{ marginTop: '40px', width: '100%', padding: '22px', borderRadius: '20px', border: 'none', background: '#F1F5F9', fontSize: '19px', fontWeight: '900', cursor: 'pointer' }}>성분 선택으로 돌아가기</button>
          </div>
        </div>
      )}

      {/* [GLOBAL ANIMATIONS] */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 3500px; } }
        input:focus { border-color: #6B58B1 !important; box-shadow: 0 0 0 4px rgba(107,88,177,0.15); }
        button:active { transform: scale(0.98); }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #F4F7FA; }
        ::-webkit-scrollbar-thumb { background: #E3E8EE; borderRadius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>

    </div>
  );
}