import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// 팀 공통 API 및 타입 임포트
import { analyzeDDI } from '../../api/ai_api';
import apiClient from '../../api/axiosConfig';

// 1. 타입 정의
interface Drug {
  item_name: string;
  name_kr: string;
  name_en: string;
}

export default function DDIPage() {
  const navigate = useNavigate();

  // 상태 관리
  const [inputDrug, setInputDrug] = useState('');
  const [suggestions, setSuggestions] = useState<Drug[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prescription, setPrescription] = useState<Drug[]>([]);
  const [result, setResult] = useState<any>(null); // 분석 결과 (cases 구조)
  const [loading, setLoading] = useState(false);

  const suggestionRef = useRef<HTMLDivElement>(null);

  // 💡 [기능] 실시간 약물 검색 (Debounce)
  useEffect(() => {
    const fetchDrugs = async () => {
      if (inputDrug.length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await apiClient.get(`ai/bentoml/drugs/search/?q=${inputDrug}`);
        setSuggestions(response.data);
        setShowSuggestions(true);
      } catch (err) {
        console.error("약물 검색 실패:", err);
      }
    };
    const timer = setTimeout(fetchDrugs, 300);
    return () => clearTimeout(timer);
  }, [inputDrug]);

  // 💡 [기능] 검색창 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addDrug = (drug: Drug) => {
    if (prescription.length >= 2) {
      alert("현재 버전은 1:1 분석만 지원합니다.");
      return;
    }
    if (!prescription.find((p) => p.item_name === drug.item_name)) {
      setPrescription([...prescription, drug]);
    }
    setInputDrug('');
    setShowSuggestions(false);
  };

  /**
   * 💡 [핵심] handleAnalysis: 데이터 유실 방지 및 자동 매핑
   * 백엔드에서 fid, feature_id, prob, probability 중 어떤 이름으로 보내도
   * 리액트가 찰떡같이 알아듣고 UI에 꽂아주는 '철벽 보정' 로직입니다.
   */
  const handleAnalysis = async () => {
    if (prescription.length < 2) {
      alert("분석을 위해 2개의 약물을 선택해주세요.");
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const data: any = await analyzeDDI(prescription as any);
      console.log("백엔드 원본 응답:", data);

      let finalData;

      // 1. 확률값 추출 (서버 필드명이 다를 경우 대비)
      const extractedProb = data.cases?.ai_personalized?.prob
        ?? data.prob
        ?? data.probability
        ?? data.detail?.prob
        ?? 0;

      // 2. 피처 아이디 추출 (f750, f57 등)
      const extractedFid = data.cases?.ai_personalized?.feature_id
        ?? data.feature_id
        ?? data.fid
        ?? (data.detail?.source === 'DUR_OFFICIAL' ? "DUR_CHECKED" : "Global");

      // 3. 임상 기전 메시지 추출
      const extractedMsg = data.cases?.ai_personalized?.message
        ?? data.message
        ?? "분석 결과 특이 기전이 감지되었습니다.";

      // 4. 최종 데이터 구조 강제 정렬
      if (data.cases) {
        finalData = {
          ...data,
          cases: {
            ...data.cases,
            ai_personalized: {
              ...data.cases.ai_personalized,
              prob: extractedProb,
              feature_id: extractedFid,
              message: extractedMsg
            }
          }
        };
      } else {
        // Flat 구조로 왔을 때의 Fallback
        const isOfficial = data.detail?.source === 'DUR_OFFICIAL';
        finalData = {
          cases: {
            standard_dur: isOfficial ? data : { level: 'SAFE', message: '식약처 공식 금기 사항 없음' },
            ai_personalized: {
              level: data.level || (extractedProb > 0.5 ? 'ATTENTION' : 'SAFE'),
              message: extractedMsg,
              prob: extractedProb,
              feature_id: extractedFid,
              source: data.detail?.source || data.source || "AI_HYBRID",
              alternatives: data.alternatives || []
            }
          }
        };
      }

      setResult(finalData);
    } catch (error: any) {
      console.error("분석 에러:", error);
      alert("AI 분석 서버와 통신할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  // UI 스타일
  const cardStyle: React.CSSProperties = {
    background: '#FFF',
    borderRadius: '16px',
    padding: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden'
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '420px 1fr',
      gap: '24px',
      padding: '24px',
      height: '100%',
      boxSizing: 'border-box',
      zoom: '0.8',
      background: '#F8F9FC'
    }}>

      {/* 1. 왼쪽: 입력 및 관리 패널 */}
      <div style={{ ...cardStyle, borderLeft: '10px solid #6B58B1' }}>
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#1A1F36', margin: '0 0 5px 0' }}>LiverGuard CDSS</h2>
          <div style={{ display: 'inline-block', background: '#6B58B1', color: '#FFF', padding: '3px 12px', borderRadius: '5px', fontSize: '12px', fontWeight: 'bold' }}>
            PRO ENGINE v5.5
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: '30px' }} ref={suggestionRef}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#4F566B', marginBottom: '8px' }}>처방 약물 검색</label>
          <input
            type="text"
            value={inputDrug}
            onChange={(e) => setInputDrug(e.target.value)}
            placeholder="제품명 또는 성분명 입력..."
            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #E3E8EE', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#FFF', border: '1px solid #E3E8EE', borderRadius: '12px', marginTop: '8px', boxShadow: '0 15px 35px rgba(50,50,93,0.1)', maxHeight: '300px', overflowY: 'auto' }}>
              {suggestions.map((drug, idx) => (
                <div key={idx} onClick={() => addDrug(drug)} style={{ padding: '15px', cursor: 'pointer', borderBottom: '1px solid #F7FAFC' }} onMouseEnter={(e) => e.currentTarget.style.background = '#F7FAFC'}>
                  <div style={{ fontWeight: '700', color: '#3C4257' }}>{drug.item_name}</div>
                  <div style={{ fontSize: '12px', color: '#8792A2' }}>{drug.name_kr} ({drug.name_en})</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#4F566B', marginBottom: '15px' }}>현재 분석 목록</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {prescription.map((drug, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', background: '#F7FAFC', borderRadius: '14px', border: '1px solid #E3E8EE' }}>
                <div>
                  <div style={{ fontWeight: '800', color: '#1A1F36' }}>{drug.item_name}</div>
                  <div style={{ fontSize: '12px', color: '#6B58B1', fontWeight: 'bold' }}>{drug.name_en}</div>
                </div>
                <button onClick={() => setPrescription(prescription.filter(d => d.item_name !== drug.item_name))} style={{ background: 'none', border: 'none', color: '#A5ADBB', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            {prescription.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8792A2', border: '2px dashed #E3E8EE', borderRadius: '14px' }}>분석할 약물을 선택하세요</div>}
          </div>
        </div>

        <button
          onClick={handleAnalysis}
          disabled={loading || prescription.length < 2}
          style={{ width: '100%', padding: '22px', borderRadius: '14px', border: 'none', background: loading ? '#A5ADBB' : '#6B58B1', color: '#FFF', fontSize: '18px', fontWeight: '800', cursor: 'pointer', marginTop: '25px', boxShadow: '0 4px 12px rgba(107,88,177,0.25)' }}
        >
          {loading ? 'AI 엔진 정밀 분석 중...' : 'V5.5 하이브리드 분석 실행 ›'}
        </button>
      </div>

      {/* 2. 오른쪽: 분석 리포트 결과 패널 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>

        {/* Case 1: 국가 표준 DUR */}
        <div style={{ ...cardStyle, borderTop: '8px solid #FFB800' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#856404' }}>Case 1. 국가 표준 DUR 분석 결과</h2>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FFB800' }}>MFDS OFFICIAL</span>
          </div>
          <div style={{ background: '#FFFBE6', padding: '22px', borderRadius: '14px', marginTop: '15px', border: '1px solid #FFE58F' }}>
            <p style={{ fontSize: '17px', color: '#856404', margin: 0, fontWeight: '600', lineHeight: '1.6' }}>
              {result?.cases?.standard_dur?.message || "처방 약물을 추가하고 분석 버튼을 눌러주세요."}
            </p>
          </div>
        </div>

        {/* Case 2: AI 임상 리포트 */}
        <div style={{ ...cardStyle, borderTop: '8px solid #00A3FF', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0050B3' }}>Case 2. AI 임상 기전 정밀 분석</h2>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#00A3FF' }}>XAI LIVER GUARD v5.5</span>
          </div>

          {result?.cases?.ai_personalized ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

              {/* 💡 분자 구조 시각화 (Hydrochloride 제거 로직 포함) */}
              <div style={{ display: 'flex', gap: '20px', background: '#F4F7FA', padding: '25px', borderRadius: '20px' }}>
                {prescription.map((p, i) => (
                  <React.Fragment key={i}>
                    <div style={{ flex: 1, textAlign: 'center', background: '#FFF', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
                      <img
                        src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(p.name_en.split(' ')[0])}/PNG`}
                        style={{ height: '110px', objectFit: 'contain', marginBottom: '10px' }}
                        alt="molecular_structure"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#4F566B' }}>{p.name_en}</div>
                    </div>
                    {i === 0 && <div style={{ alignSelf: 'center', fontSize: '30px', fontWeight: 'bold', color: '#CBD5E1' }}>+</div>}
                  </React.Fragment>
                ))}
              </div>

              {/* 💡 SHAP 분석 결과 (기전 설명) */}
              <div style={{ borderLeft: '6px solid #00A3FF', paddingLeft: '25px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#1A1F36' }}>
                  [XAI 분석 결과: <span style={{ color: '#00A3FF' }}>{result.cases.ai_personalized.feature_id}</span>]
                </h4>
                <p style={{ fontSize: '17px', lineHeight: '1.8', color: '#3C4257', margin: 0, fontWeight: '600' }}>
                  <strong>임상 기전:</strong> {result.cases.ai_personalized.message}
                </p>
                <div style={{ marginTop: '12px', display: 'flex', gap: '15px' }}>
                  <span style={{ fontSize: '14px', color: '#8792A2' }}>분석 신뢰도: <strong>{(parseFloat(result.cases.ai_personalized.prob || 0) * 100).toFixed(1)}%</strong></span>
                  <span style={{ fontSize: '14px', color: '#8792A2' }}>분석 모드: <strong>{result.cases.ai_personalized.source || 'AI_HYBRID'}</strong></span>
                </div>
              </div>

              {/* 💡 의료진 권고 사항 및 대체 약물 버튼 */}
              <div style={{ background: result.cases.ai_personalized.level === 'CRITICAL' ? '#FFF1F0' : '#F0F9FF', padding: '22px', borderRadius: '15px', border: '1px solid #BAE7FF' }}>
                <h4 style={{ margin: '0 0 12px 0', color: result.cases.ai_personalized.level === 'CRITICAL' ? '#CF1322' : '#0050B3', fontSize: '16px', fontWeight: '900' }}>💡 의료진 권고 사항 (CDSS)</h4>
                <p style={{ fontSize: '16px', color: '#1A1F36', margin: '0 0 18px 0', lineHeight: '1.6' }}>
                  {result.cases.ai_personalized.level === 'CRITICAL' || result.cases.standard_dur.level === 'CRITICAL'
                    ? "⚠️ 병용 시 심각한 부작용 위험이 매우 높습니다. 아래 대체 약물 처방을 적극 고려하십시오."
                    : "🔍 특정 대사 경로의 간섭 가능성이 확인되었습니다. 환자의 간 수치 지표를 모니터링하며 처방하시기 바랍니다."}
                </p>

                {/* 대체 약물 버튼 렌더링 */}
                {result.cases.ai_personalized.alternatives && result.cases.ai_personalized.alternatives.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {result.cases.ai_personalized.alternatives.map((alt: string, i: number) => (
                      <button
                        key={i}
                        style={{ padding: '8px 18px', background: '#FFF', border: '2px solid #00A3FF', borderRadius: '25px', color: '#00A3FF', fontSize: '13px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#00A3FF11')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#FFF')}
                        onClick={() => alert(`${alt} 성분으로의 대체 가능성을 시뮬레이션합니다.`)}
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#A5ADBB' }}>
              <div style={{ fontSize: '50px', marginBottom: '15px' }}>🧬</div>
              <p style={{ fontSize: '16px' }}>{loading ? '약물 구조 분석 및 임상 기전 매핑 중...' : '약물을 추가하고 분석을 시작하세요.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}