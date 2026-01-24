import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/axiosConfig';

/**
 * 🛡️ LiverGuard v8.9.7 PRO (Professional CDSS Edition)
 * [업데이트 완료]
 * 1. 디자인: 사이드바 borderTop 제거 후 borderLeft(14px) 강조로 변경
 * 2. 효율화: 프론트엔드 내 하드코딩된 DDI 맵 제거 (백엔드 summary_title 사용)
 * 3. 안정성: 이미지 무한 루프 차단 및 모달 시스템 유지
 */

// --- 1. 인터페이스 정의 ---
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
    final_status: string;
    final_message: string;
    summary_title: string; // ✅ 백엔드에서 전송하는 요약 제목 필드
    source: string;
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

  // --- 상태 관리 ---
  const [inputDrug, setInputDrug] = useState('');
  const [suggestions, setSuggestions] = useState<Drug[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prescription, setPrescription] = useState<Drug[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<{ interactions: InteractionItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // 💡 이미지 에러 발생 여부를 추적하는 상태 (무한 루프 방지 핵심)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const [altListModal, setAltListModal] = useState<{ targetItemName: string; alternatives: Alternative[]; } | null>(null);
  const [selectionModal, setSelectionModal] = useState<{ targetItemName: string; alt: Alternative; } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const comboRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // 처방전 페이지에서 전달받은 약물 목록 또는 이전 DDI 상태 로드
  useEffect(() => {
    // 1. 처방전 페이지에서 전달받은 약물 목록 우선 로드
    const savedPrescription = sessionStorage.getItem('ddi_prescription');
    if (savedPrescription) {
      try {
        const meds = JSON.parse(savedPrescription);
        const drugs: Drug[] = meds.map((m: any) => ({
          item_name: m.item_name || m.name || '',
          name_en: m.name_en || '',
          name_kr: m.name_kr || ''
        })).filter((d: Drug) => d.item_name);
        if (drugs.length > 0) {
          setPrescription(drugs);
        }
        sessionStorage.removeItem('ddi_prescription');
        return; // 처방전에서 온 데이터 우선
      } catch (e) {
        console.error('처방 목록 로드 실패:', e);
      }
    }

    // 2. 이전 DDI 탭 상태 복원 (탭 전환 후 돌아올 때)
    const savedDdiState = sessionStorage.getItem('ddi_state');
    if (savedDdiState) {
      try {
        const state = JSON.parse(savedDdiState);
        if (state.prescription) setPrescription(state.prescription);
        if (state.analysisSummary) setAnalysisSummary(state.analysisSummary);
        if (state.expandedIdx !== undefined) setExpandedIdx(state.expandedIdx);
      } catch (e) {
        console.error('DDI 상태 복원 실패:', e);
      }
    }
  }, []);

  // DDI 상태 변경 시 sessionStorage에 저장 (탭 전환 시 유지용)
  useEffect(() => {
    if (prescription.length > 0 || analysisSummary) {
      sessionStorage.setItem('ddi_state', JSON.stringify({
        prescription,
        analysisSummary,
        expandedIdx
      }));
    }
  }, [prescription, analysisSummary, expandedIdx]);

  // 초기화 핸들러
  const handleReset = () => {
    if (confirm('처방 목록과 분석 결과를 모두 초기화하시겠습니까?')) {
      setPrescription([]);
      setAnalysisSummary(null);
      setExpandedIdx(null);
      setInputDrug('');
      setSuggestions([]);
      setImgErrors({});
      sessionStorage.removeItem('ddi_state');
    }
  };

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

  // --- 비즈니스 로직 ---

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

  const handleAnalysis = async () => {
    if (prescription.length < 2) { alert("상호작용 분석을 위해 2개 이상의 약물을 선택하십시오."); return; }
    setLoading(true);
    setAnalysisSummary(null);
    try {
      const response = await apiClient.post('ai/bentoml/ddi/analyze/', { prescription });
      setAnalysisSummary(response.data);
      setExpandedIdx(0);
    } catch (error) {
      alert("DDI 분석 엔진 응답 실패. 서버 상태를 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

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
        const response = await apiClient.post('ai/bentoml/ddi/analyze/', { prescription: updatedPrescription });
        setAnalysisSummary(response.data);
      }
    } catch (error) {
      console.error("약물 교체 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  const processedInteractions = (analysisSummary?.interactions || [])
    .filter((item) => item.analysis.final_status !== 'SAFE')
    .sort((a, b) => {
      const scoreMap: any = { CRITICAL: 3, MONITORING: 2, WARNING: 1 };
      return (scoreMap[b.analysis.final_status] || 0) - (scoreMap[a.analysis.final_status] || 0);
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', padding: '24px', height: '100%', maxHeight: '100vh', boxSizing: 'border-box', zoom: '0.85', background: '#F4F7FA', fontFamily: 'Pretendard, sans-serif', overflow: 'hidden' }}>

      {/* [SIDEBAR] - borderTop에서 borderLeft로 변경 및 두께 강화 */}
      <div style={{ background: '#FFF', borderRadius: '24px', padding: '35px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', borderLeft: '14px solid #6B58B1', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '950', color: '#1A1F36', marginBottom: '5px' }}>LiverGuard</h2>
          <p style={{ color: '#6B58B1', fontWeight: '800', fontSize: '14px' }}>PRO CDSS ENGINE v8.9.7</p>
        </div>

        <div style={{ position: 'relative', marginBottom: '35px' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: '800', color: '#4F566B', marginBottom: '12px' }}>의약품 추가 검색 (Search)</label>
          <input
            type="text"
            value={inputDrug}
            onChange={(e) => setInputDrug(e.target.value)}
            placeholder="제품명 또는 성분명 입력..."
            className="search-input"
            style={{ width: '100%', padding: '18px', borderRadius: '15px', border: '2px solid #E3E8EE', fontSize: '16px', fontWeight: '600', outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#FFF', border: '1px solid #E3E8EE', borderRadius: '15px', marginTop: '10px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', maxHeight: '350px', overflowY: 'auto' }}>
              {suggestions.map((drug, i) => (
                <div key={i} onClick={() => addDrug(drug)} style={{ padding: '15px 20px', cursor: 'pointer', borderBottom: '1px solid #F7FAFC' }}>
                  <div style={{ fontWeight: '800', color: '#1E293B' }}>{drug.item_name}</div>
                  <div style={{ fontSize: '12px', color: '#8792A2', marginTop: '4px' }}>{drug.name_kr} | <span style={{ color: '#6B58B1' }}>{drug.name_en}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#4F566B', margin: 0 }}>
              현재 처방 목록 <span style={{ color: '#6B58B1' }}>{prescription.length}/10</span>
            </h3>
            {prescription.length > 0 && (
              <button
                onClick={handleReset}
                style={{
                  padding: '6px 12px', background: '#FEF2F2', color: '#EF4444',
                  border: '1.5px solid #EF4444', borderRadius: '8px', fontSize: '12px',
                  fontWeight: '700', cursor: 'pointer'
                }}
              >
                초기화
              </button>
            )}
          </div>
          {prescription.map((drug, i) => (
            <div key={i} className="prescription-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '900', color: '#1A1F36', fontSize: '15px', lineHeight: '1.3' }}>{drug.item_name}</div>
                <div style={{ fontSize: '11px', color: '#6B58B1', fontWeight: '700', marginTop: '5px' }}>{drug.name_en.toUpperCase()}</div>
              </div>
              <button onClick={() => setPrescription(prescription.filter(p => p.item_name !== drug.item_name))} style={{ background: 'none', border: 'none', color: '#A5ADBB', fontSize: '22px', cursor: 'pointer', marginLeft: '10px' }}>✕</button>
            </div>
          ))}
          {prescription.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#A5ADBB', fontSize: '15px', fontWeight: '600' }}>분석할 약물을 추가하십시오.</div>
          )}
        </div>

        <button onClick={handleAnalysis} disabled={loading || prescription.length < 2} className="analyze-btn">
          {loading ? '임상 데이터 통합 분석 중...' : `DDI 엔진 실행 (N:${prescription.length}) ›`}
        </button>
      </div>

      {/* [MAIN CONTENT] */}
      <div ref={scrollContainerRef} style={{ overflowY: 'auto', overflowX: 'hidden', paddingRight: '10px', height: '100%' }}>
        {!analysisSummary ? (
          <div className="empty-state">
            <div style={{ fontSize: '80px', marginBottom: '25px' }}>🔬</div>
            <h3 style={{ fontSize: '26px', fontWeight: '950', color: '#4F566B' }}>Expert CDSS Ready</h3>
            <p style={{ fontWeight: '600', fontSize: '17px' }}>처방전을 구성한 뒤 상호작용 분석을 시작하십시오.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="report-sticky-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '950', color: '#1E3A8A' }}>Clinical Interaction Report</h2>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#6B58B1', marginTop: '3px' }}>총 감지 항목: {processedInteractions.length}건</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {processedInteractions.map((_, i) => (
                  <button key={i} onClick={() => { setExpandedIdx(i); comboRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={`pair-nav-btn ${expandedIdx === i ? 'active' : ''}`}>Pair {i + 1}</button>
                ))}
              </div>
            </div>

            {processedInteractions.map((item, idx) => {
              const isExpanded = expandedIdx === idx;
              const { color, bg, label } = getLevelInfo(item.analysis.final_status);
              const detail = item.analysis.ai_personalized.clinical_details;
              const sourceLabel = item.analysis.source === 'DUR_KOREA' ? '🇰🇷 식약처 DUR' : item.analysis.source === 'DRUGBANK' ? '🌍 DrugBank' : '🤖 AI ENGINE';

              return (
                <div key={idx} ref={el => comboRefs.current[idx] = el} style={{ background: '#FFF', borderRadius: '30px', borderLeft: `14px solid ${color}`, boxShadow: '0 10px 35px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <div style={{ padding: '35px 45px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? bg : '#FFF', cursor: 'pointer' }} onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '25px', fontWeight: '950', color: '#1E293B', margin: 0 }}>
                        <span style={{ color: '#CBD5E1', marginRight: '20px', fontWeight: '700' }}>#0{idx + 1}</span>
                        {item.pair[0].item_name.split('(')[0]} + {item.pair[1].item_name.split('(')[0]}
                      </h3>
                      <div style={{ color: color, fontWeight: '900', fontSize: '17px', marginTop: '12px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <span style={{ background: color, color: '#FFF', padding: '3px 12px', borderRadius: '7px', fontSize: '13px', fontWeight: '800' }}>{label}</span>
                        <span style={{ color: '#64748B', fontSize: '14px', fontWeight: '700' }}>[{sourceLabel}]</span>
                        {/* ✅ API에서 전송받은 요약 제목 표시 */}
                        {item.analysis.summary_title}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setAltListModal({ targetItemName: item.pair[0].item_name, alternatives: item.analysis.ai_personalized.alternatives_d1 })} className="replace-btn blue-line">교체: {item.pair[0].item_name.split('(')[0]}</button>
                      <button onClick={() => setAltListModal({ targetItemName: item.pair[1].item_name, alternatives: item.analysis.ai_personalized.alternatives_d2 })} className="replace-btn navy-line">교체: {item.pair[1].item_name.split('(')[0]}</button>
                      <div style={{ fontSize: '24px', color: '#CBD5E1', marginLeft: '10px' }}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 45px 45px 45px' }} className="expand-animation">
                      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', padding: '12px 0', borderBottom: '1.5px solid #F1F5F9' }}>
                        <span className="meta-tag">📊 EVIDENCE: <b>{detail?.evidence_level || 'Grade B'}</b></span>
                        <span className="meta-tag">⏱️ ONSET: <b>{detail?.onset || 'Variable'}</b></span>
                        <span className="meta-tag">🆔 FEATURE ID: <b style={{ color: '#6B58B1' }}>{item.analysis.ai_personalized.feature_id || 'Global'}</b></span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '35px' }}>
                        {[0, 1].map(i => (
                          <div key={i} className="drug-visual-card">
                            <div className="molecule-box">
                              {imgErrors[item.pair[i].name_en] ? (
                                <div className="molecule-placeholder">💊</div>
                              ) : (
                                <img
                                  src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(item.pair[i].name_en.split(' ')[0])}/PNG`}
                                  style={{ height: '85px', width: '85px', objectFit: 'contain' }}
                                  alt="molecule"
                                  onError={() => setImgErrors(prev => ({ ...prev, [item.pair[i].name_en]: true }))}
                                />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: '950', fontSize: '20px', color: '#1E293B' }}>{item.pair[i].item_name}</div>
                              <div style={{ fontSize: '13px', color: '#6B58B1', fontWeight: '800', marginTop: '6px' }}>{item.pair[i].name_en.toUpperCase()}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="rationale-container">
                          <h4 className="rationale-header">🤖 CDSS Clinical Rationale <span>VERIFIED</span></h4>
                          {detail ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                              <div className="rationale-section red">
                                <div className="section-title">① CLINICAL IMPACT (임상적 결과)</div>
                                <div className="section-content">{detail.clinical_summary} <br /><span>{detail.impact}</span></div>
                              </div>
                              <div className="rationale-section purple">
                                <div className="section-title">② MOLECULAR LOGIC (발생 기전)</div>
                                <div className="section-content">{detail.molecular_logic}</div>
                              </div>
                              <div className="rationale-section green">
                                <div className="section-title">③ RECOMMENDATION & MONITORING (조치 및 모니터링)</div>
                                <div className="section-content">{detail.recommendation?.action} <br /><span>• 필수 모니터링 지표: {detail.recommendation?.monitoring_param}</span></div>
                              </div>
                              <div className="rationale-section blue">
                                <div className="section-title">④ ALTERNATIVE RATIONALE (대체제 근거)</div>
                                <div className="section-content">{detail.recommendation?.alternative_logic || '동일 계열의 타 안전 약물로의 교체를 검토하십시오.'}</div>
                              </div>
                            </div>
                          ) : <p className="loading-text">기전 분석 데이터를 통합 중입니다...</p>}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '15px' }}>
                          {[0, 1].map(i => (
                            <div key={i} className="alt-grid-box">
                              <div className={`alt-title ${i === 0 ? 'purple' : 'blue'}`}>💊 {item.pair[i].item_name.split('(')[0]} 대체 처방 옵션</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {(i === 0 ? item.analysis.ai_personalized.alternatives_d1 : item.analysis.ai_personalized.alternatives_d2).slice(0, 4).map((alt: any, k: number) => (
                                  <button key={k} onClick={() => setSelectionModal({ targetItemName: item.pair[i].item_name, alt })} className={`alt-chip ${i === 0 ? 'purple' : 'blue'}`}>{alt.product}</button>
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

      {/* --- MODALS --- */}

      {altListModal && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h2 className="modal-title">Smart-Swap: 대체 성분 추천</h2>
            <p className="modal-desc">대상 약물: <strong>{altListModal.targetItemName}</strong></p>
            <div className="alt-list">
              {altListModal.alternatives.map((alt, i) => (
                <button key={i} onClick={() => { setSelectionModal({ targetItemName: altListModal.targetItemName, alt }); setAltListModal(null); }} className="alt-btn">
                  {alt.product} <span>({alt.ingredient})</span>
                </button>
              ))}
              {altListModal.alternatives.length === 0 && <p className="no-data">추천 가능한 안전 대체제가 현재 데이터베이스에 없습니다.</p>}
            </div>
            <button onClick={() => setAltListModal(null)} className="modal-close-btn">취소 후 리포트로 돌아가기</button>
          </div>
        </div>
      )}

      {selectionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">최종 제품 및 함량 선택</h2>
            <p className="modal-desc">선택 성분: <strong>{selectionModal.alt.product} ({selectionModal.alt.ingredient})</strong></p>
            <div className="product-list">
              {selectionModal.alt.related_products.map((p, i) => (
                <div key={i} onClick={() => executeReplace(selectionModal.targetItemName, p)} className="product-item">
                  <span style={{ fontSize: '28px' }}>💊</span> {p}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectionModal(null)} className="modal-close-btn gray">성분 선택으로 돌아가기</button>
          </div>
        </div>
      )}

      {/* [GLOBAL STYLES & ANIMATIONS] */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 3500px; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }

        .search-input:focus { border-color: #6B58B1 !important; box-shadow: 0 0 0 4px rgba(107,88,177,0.15); }
        .prescription-item { padding: 20px; background: #F8FAFC; borderRadius: 16px; border: 1.5px solid #E3E8EE; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; animation: fadeIn 0.3s ease; }
        .analyze-btn { width: 100%; padding: 24px; border-radius: 18px; background: #6B58B1; color: #FFF; font-size: 20px; font-weight: 900; border: none; cursor: pointer; margin-top: 25px; box-shadow: 0 8px 20px rgba(107,88,177,0.3); transition: all 0.2s; }
        .analyze-btn:disabled { background: #A5ADBB; cursor: not-allowed; }
        .analyze-btn:active { transform: scale(0.98); }

        .empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FFF; border-radius: 24px; border: 2px dashed #E3E8EE; color: #A5ADBB; }
        .report-sticky-header { position: sticky; top: 0; z-index: 100; background: #F0F4FF; padding: 20px 35px; border-radius: 22px; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #D1E0FF; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        
        .pair-nav-btn { padding: 10px 20px; background: #FFF; color: #6B58B1; border: 2px solid #D1E0FF; border-radius: 12px; font-weight: 900; cursor: pointer; transition: all 0.2s; }
        .pair-nav-btn.active { background: #6B58B1; color: #FFF; border-color: #6B58B1; }

        .replace-btn { padding: 12px 22px; background: #FFF; border-radius: 50px; font-size: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .replace-btn.blue-line { border: 2.5px solid #6B58B1; color: #6B58B1; }
        .replace-btn.navy-line { border: 2.5px solid #1E40AF; color: #1E40AF; }

        .expand-animation { animation: slideDown 0.4s ease-in-out; }
        .meta-tag { font-size: 14px; font-weight: 800; color: #64748B; }
        .meta-tag b { color: #1E293B; }

        .drug-visual-card { background: #F8FAFC; padding: 25px 30px; border-radius: 24px; border: 1.5px solid #E2E8F0; display: flex; align-items: center; gap: 30px; }
        .molecule-box { background: #FFF; padding: 12px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.06); width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .molecule-placeholder { font-size: 45px; animation: pulse 2s infinite; }

        .rationale-container { background: #FFF; padding: 40px; border-radius: 28px; border: 2px solid #F1F5F9; box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
        .rationale-header { color: #1E40AF; font-size: 21px; font-weight: 900; margin-bottom: 30px; display: flex; align-items: center; gap: 12px; }
        .rationale-header span { font-size: 12px; background: #F0F4FF; color: #1E40AF; padding: 4px 10px; border-radius: 6px; }

        .rationale-section { border-left: 6px solid #DDD; padding-left: 22px; margin-bottom: 28px; }
        .rationale-section.red { border-color: #EF4444; }
        .rationale-section.purple { border-color: #6B58B1; }
        .rationale-section.green { border-color: #10B981; }
        .rationale-section.blue { border-color: #3B82F6; }

        .section-title { font-size: 15px; font-weight: 900; margin-bottom: 8px; }
        .red .section-title { color: #EF4444; }
        .purple .section-title { color: #6B58B1; }
        .green .section-title { color: #10B981; }
        .blue .section-title { color: #3B82F6; }

        .section-content { font-size: 18px; font-weight: 850; color: #1E293B; line-height: 1.5; }
        .section-content span { color: #64748B; font-size: 15px; font-weight: 600; display: block; margin-top: 5px; }

        .alt-grid-box { background: #F8FAFC; padding: 25px; border-radius: 22px; border: 1.5px solid #E2E8F0; }
        .alt-title { font-size: 15px; font-weight: 900; margin-bottom: 18px; }
        .alt-title.purple { color: #6B58B1; }
        .alt-title.blue { color: #1E40AF; }

        .alt-chip { padding: 12px 20px; background: #FFF; border-radius: 12px; font-size: 14px; font-weight: 900; cursor: pointer; transition: all 0.2s; }
        .alt-chip.purple { border: 2px solid #6B58B1; color: #6B58B1; }
        .alt-chip.blue { border: 2px solid #1E40AF; color: #1E40AF; }
        .alt-chip:hover { transform: translateY(-2px); box-shadow: 0 5px 10px rgba(0,0,0,0.1); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(10px); }
        .modal-content { background: #FFF; border-radius: 35px; padding: 55px; width: 600px; box-shadow: 0 40px 100px rgba(0,0,0,0.6); }
        .modal-content.large { width: 800px; }
        .modal-title { font-size: 32px; font-weight: 950; margin-bottom: 15px; color: #1A1F36; }
        .modal-desc { color: #64748B; margin-bottom: 40px; font-size: 19px; }
        .alt-list, .product-list { display: flex; flex-wrap: wrap; gap: 18px; max-height: 450px; overflow-y: auto; padding: 5px; }
        .alt-btn { padding: 20px 35px; background: #F8FAFC; border: 2.5px solid #E2E8F0; border-radius: 20px; font-weight: 900; font-size: 19px; cursor: pointer; }
        .alt-btn span { font-size: 14px; color: #6B58B1; margin-left: 10px; }
        .product-item { width: 100%; padding: 24px; background: #F8FAFC; border-radius: 20px; border: 2.5px solid #E2E8F0; cursor: pointer; font-weight: 900; font-size: 20px; display: flex; align-items: center; gap: 20px; }
        
        .modal-close-btn { margin-top: 40px; width: 100%; padding: 24px; border-radius: 20px; border: none; background: #6B58B1; color: #FFF; font-size: 20px; font-weight: 900; cursor: pointer; }
        .modal-close-btn.gray { background: #F1F5F9; color: #475569; }
        .no-data { color: #94A3B8; font-size: 18px; font-weight: 700; width: 100%; text-align: center; padding: 40px; }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #F4F7FA; }
        ::-webkit-scrollbar-thumb { background: #E3E8EE; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}