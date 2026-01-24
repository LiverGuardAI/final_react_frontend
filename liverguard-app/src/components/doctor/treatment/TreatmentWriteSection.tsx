import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';
import apiClient from '../../../api/axiosConfig';

// 약물 검색 결과 타입
interface DrugSuggestion {
    item_name: string;
    name_kr: string;
    name_en: string;
}

// DDI 결과 요약 타입
interface DDISummary {
    hasInteraction: boolean;
    count: number;
    maxLevel: 'CRITICAL' | 'MONITORING' | 'WARNING' | 'SAFE';
    interactions: Array<{
        drug1: string;
        drug2: string;
        level: string;
        summary: string;
    }>;
}

// Medication 타입 확장
interface Medication {
    name: string;
    name_en?: string;
    name_kr?: string;
    dosage: string;
    frequency: string;
    days: string;
}

interface TreatmentWriteSectionProps {
    rightTab: 'record' | 'prescription';
    setRightTab: (tab: 'record' | 'prescription') => void;
    chiefComplaint: string;
    setChiefComplaint: (value: string) => void;
    clinicalNotes: string;
    setClinicalNotes: (value: string) => void;
    diagnosisName: string;
    setDiagnosisName: (value: string) => void;
    selectedOrders: string[];
    handleOrderToggle: (order: string) => void;
    orderRequests: any;
    setOrderRequests: (value: any) => void;
    hccDetails: any;
    setHccDetails: (value: any) => void;
    onComplete: () => void;
    onTempSave?: () => void;
    onAiSuggest?: () => void;
    aiSuggesting?: boolean;
    disabled?: boolean;
    medications?: Medication[];
    onAddMedication?: () => void;
    onRemoveMedication?: (index: number) => void;
    onMedicationChange?: (index: number, field: string, value: string) => void;
    onSelectDrug?: (index: number, drug: DrugSuggestion) => void;
    onCancel?: () => void;
    onViewDDIDetails?: () => void;
}

export default function TreatmentWriteSection({
    rightTab,
    setRightTab,
    chiefComplaint,
    setChiefComplaint,
    clinicalNotes,
    setClinicalNotes,
    diagnosisName,
    setDiagnosisName,
    selectedOrders,
    handleOrderToggle,
    orderRequests,
    setOrderRequests,
    hccDetails,
    setHccDetails,
    onComplete,
    onTempSave,
    onAiSuggest,
    aiSuggesting = false,
    disabled = false,
    medications = [],
    onAddMedication,
    onRemoveMedication,
    onMedicationChange,
    onSelectDrug,
    onCancel,
    onViewDDIDetails
}: TreatmentWriteSectionProps) {

    // 약물 검색 상태
    const [searchIndex, setSearchIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // DDI 검사 상태
    const [ddiSummary, setDdiSummary] = useState<DDISummary | null>(null);
    const [ddiLoading, setDdiLoading] = useState(false);

    // 약물 검색 API 호출 (debounce)
    const searchDrugs = useCallback(async (query: string) => {
        if (query.length < 1) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await apiClient.get(`ai/bentoml/drugs/search/?q=${encodeURIComponent(query)}`);
            setSuggestions(Array.isArray(response.data) ? response.data.slice(0, 10) : []);
            setShowSuggestions(true);
        } catch (err) {
            console.error('약물 검색 실패:', err);
            setSuggestions([]);
        }
    }, []);

    // 검색어 변경 시 debounce 처리
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        if (searchQuery && searchIndex !== null) {
            searchTimeoutRef.current = setTimeout(() => {
                searchDrugs(searchQuery);
            }, 300);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, searchIndex, searchDrugs]);

    // 약물 선택 처리
    const handleSelectDrug = (drug: DrugSuggestion) => {
        if (searchIndex !== null && onSelectDrug) {
            onSelectDrug(searchIndex, drug);
        }
        setShowSuggestions(false);
        setSearchQuery('');
        setSearchIndex(null);
    };

    // DDI 검사 실행
    const handleDDICheck = async () => {
        const validMeds = medications.filter(m => m.name && m.name.trim());
        if (validMeds.length < 2) {
            alert('상호작용 분석을 위해 2개 이상의 약물을 입력하세요.');
            return;
        }

        setDdiLoading(true);
        try {
            const response = await apiClient.post('ai/bentoml/ddi/analyze/', {
                prescription: validMeds.map(m => ({
                    item_name: m.name,
                    name_en: m.name_en || '',
                    name_kr: m.name_kr || ''
                }))
            });

            const interactions = response.data?.interactions || [];
            const problematic = interactions.filter((i: any) => i.analysis?.final_status !== 'SAFE');

            // 최고 위험 레벨 찾기
            let maxLevel: 'CRITICAL' | 'MONITORING' | 'WARNING' | 'SAFE' = 'SAFE';
            if (problematic.some((i: any) => i.analysis?.final_status === 'CRITICAL')) maxLevel = 'CRITICAL';
            else if (problematic.some((i: any) => i.analysis?.final_status === 'MONITORING')) maxLevel = 'MONITORING';
            else if (problematic.some((i: any) => i.analysis?.final_status === 'WARNING')) maxLevel = 'WARNING';

            setDdiSummary({
                hasInteraction: problematic.length > 0,
                count: problematic.length,
                maxLevel,
                interactions: problematic.slice(0, 3).map((i: any) => ({
                    drug1: i.pair?.[0]?.item_name?.split('(')[0] || '',
                    drug2: i.pair?.[1]?.item_name?.split('(')[0] || '',
                    level: i.analysis?.final_status || 'SAFE',
                    summary: i.analysis?.summary_title || ''
                }))
            });
        } catch (err) {
            console.error('DDI 분석 실패:', err);
            alert('DDI 분석 중 오류가 발생했습니다.');
        } finally {
            setDdiLoading(false);
        }
    };

    // DDI 상세 페이지로 이동
    const handleViewDetails = () => {
        // 현재 처방 목록을 sessionStorage에 저장
        sessionStorage.setItem('ddi_prescription', JSON.stringify(
            medications.filter(m => m.name).map(m => ({
                item_name: m.name,
                name_en: m.name_en || '',
                name_kr: m.name_kr || ''
            }))
        ));
        onViewDDIDetails?.();
    };

    const isHCCDiagnosis = diagnosisName.toLowerCase().includes('hcc') ||
        diagnosisName.toLowerCase().includes('간암') ||
        diagnosisName.toLowerCase().includes('hepatocellular');

    return (
        <div className={styles.rightSection}>
            <div className={styles.writeCard}>
                {/* 탭 헤더 */}
                <div className={styles.tabHeader}>
                    <div className={styles.tabButtons}>
                        <button
                            onClick={() => setRightTab('record')}
                            className={`${styles.tabButton} ${rightTab === 'record' ? styles.active : ''}`}
                        >
                            진료기록 작성

                            {aiSuggesting ? "AI \uC791\uC131\uC911..." : "AI \uC81C\uC548"}
                        </button>
                        <button
                            onClick={() => setRightTab('prescription')}
                            className={`${styles.tabButton} ${rightTab === 'prescription' ? styles.active : ''}`}
                        >
                            처방전 작성
                        </button>
                    </div>
                </div>

                {/* 탭 컨텐츠 */}
                <div className={styles.tabContent}>
                    {rightTab === 'record' ? (
                        <div className={styles.formSection}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>주증상</label>
                                <input
                                    type="text"
                                    placeholder="환자의 주증상을 입력하세요"
                                    className={styles.formInput}
                                    value={chiefComplaint}
                                    onChange={(e) => setChiefComplaint(e.target.value)}
                                    disabled={disabled}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <div className={styles.formLabelRow}>
                                    <label className={styles.formLabel}>진료 내용</label>
                                    <button
                                        className={styles.aiButton}
                                        onClick={() => onAiSuggest?.()}
                                        disabled={disabled || aiSuggesting}
                                    >
                                        {aiSuggesting ? "AI \uC791\uC131\uC911..." : "AI \uC81C\uC548"}
                                    </button>
                                </div>
                                <textarea
                                    placeholder="진료 내용을 입력하세요"
                                    className={styles.formTextarea}
                                    value={clinicalNotes}
                                    onChange={(e) => setClinicalNotes(e.target.value)}
                                    disabled={disabled}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>검사/처방 오더 선택</label>
                                <div className={styles.orderCheckboxes}>
                                    {['신체 계측', '바이탈 측정', '혈액검사', 'CT 촬영', '유전체 검사'].map((order) => (
                                        <label key={order} className={styles.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={selectedOrders.includes(order)}
                                                onChange={() => handleOrderToggle(order)}
                                                disabled={disabled}
                                            />
                                            <span>{order}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* 상세 요청 폼 (유전체 검사) */}
                                {selectedOrders.includes('유전체 검사') && (
                                    <div className={styles.orderDetailBox}>
                                        <h5 className={styles.orderDetailTitle}>유전체 검사 요청</h5>
                                        <p style={{ fontSize: '13px', color: '#666', margin: '0' }}>간암 관련 유전자 패널 분석을 요청합니다.</p>
                                        <input
                                            type="text"
                                            className={styles.formInputSmall}
                                            placeholder="특이 요청사항"
                                            value={orderRequests.genomic.notes}
                                            onChange={(e) => setOrderRequests({ ...orderRequests, genomic: { ...orderRequests.genomic, notes: e.target.value } })}
                                            disabled={disabled}
                                        />
                                    </div>
                                )}

                                {/* 상세 요청 폼 (신체 계측) */}
                                {selectedOrders.includes('신체 계측') && (
                                    <div className={styles.orderDetailBox}>
                                        <h5 className={styles.orderDetailTitle}>신체 계측 요청</h5>
                                        <input
                                            type="text"
                                            className={styles.formInputSmall}
                                            placeholder="특이 요청사항"
                                            value={orderRequests.physical.notes}
                                            onChange={(e) => setOrderRequests({ ...orderRequests, physical: { ...orderRequests.physical, notes: e.target.value } })}
                                            disabled={disabled}
                                        />
                                    </div>
                                )}

                                {/* 상세 요청 폼 (바이탈 측정) */}
                                {selectedOrders.includes('바이탈 측정') && (
                                    <div className={styles.orderDetailBox}>
                                        <h5 className={styles.orderDetailTitle}>바이탈 측정 요청</h5>
                                        <input
                                            type="text"
                                            className={styles.formInputSmall}
                                            placeholder="특이 요청사항"
                                            value={orderRequests.vital.notes}
                                            onChange={(e) => setOrderRequests({ ...orderRequests, vital: { ...orderRequests.vital, notes: e.target.value } })}
                                            disabled={disabled}
                                        />
                                    </div>
                                )}

                                {/* 상세 요청 폼 (혈액 검사) */}
                                {selectedOrders.includes('혈액검사') && (
                                    <div className={styles.orderDetailBox}>
                                        <h5 className={styles.orderDetailTitle}>혈액 검사 요청</h5>
                                        <select
                                            className={styles.formSelect}
                                            value={orderRequests.lab.type}
                                            onChange={(e) => setOrderRequests({ ...orderRequests, lab: { ...orderRequests.lab, type: e.target.value } })}
                                            disabled={disabled}
                                        >
                                            <option value="BLOOD_LIVER">간기능 검사 (LFT)</option>
                                            <option value="cbc">일반 혈액 검사 (CBC)</option>
                                            <option value="hepatitis">간염 바이러스 표지자</option>
                                        </select>
                                        <input
                                            type="text"
                                            className={styles.formInputSmall}
                                            placeholder="임상 소견 / 요청사항"
                                            value={orderRequests.lab.notes}
                                            onChange={(e) => setOrderRequests({ ...orderRequests, lab: { ...orderRequests.lab, notes: e.target.value } })}
                                            disabled={disabled}
                                        />
                                    </div>
                                )}

                                {/* 상세 요청 폼 (CT 촬영) */}
                                {selectedOrders.includes('CT 촬영') && (
                                    <div className={styles.orderDetailBox}>
                                        <h5 className={styles.orderDetailTitle}>CT 촬영 요청</h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <select
                                                className={styles.formSelect}
                                                value={orderRequests.imaging.modality}
                                                onChange={(e) => setOrderRequests({ ...orderRequests, imaging: { ...orderRequests.imaging, modality: e.target.value } })}
                                                disabled={disabled}
                                            >
                                                <option value="CT">CT</option>
                                                <option value="MRI">MRI</option>
                                                <option value="US">Ultrasound</option>
                                            </select>
                                            <select
                                                className={styles.formSelect}
                                                value={orderRequests.imaging.bodyPart}
                                                onChange={(e) => setOrderRequests({ ...orderRequests, imaging: { ...orderRequests.imaging, bodyPart: e.target.value } })}
                                                disabled={disabled}
                                            >
                                                <option value="Abdomen">복부 (Abdomen)</option>
                                                <option value="Chest">흉부 (Chest)</option>
                                                <option value="Brain">뇌 (Brain)</option>
                                            </select>
                                        </div>
                                        <input
                                            type="text"
                                            className={styles.formInputSmall}
                                            placeholder="임상 정보 (Clinical Info)"
                                            value={orderRequests.imaging.notes}
                                            onChange={(e) => setOrderRequests({ ...orderRequests, imaging: { ...orderRequests.imaging, notes: e.target.value } })}
                                            disabled={disabled}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>진단명 (Diagnosis)</label>
                                <input
                                    type="text"
                                    placeholder="진단명을 입력하세요"
                                    className={styles.formInput}
                                    value={diagnosisName}
                                    onChange={(e) => setDiagnosisName(e.target.value)}
                                    disabled={disabled}
                                />
                            </div>

                            {/* HCC 세부 정보 폼 */}
                            {isHCCDiagnosis && (
                                <div className={styles.hccDetailsSection}>
                                    <h4 className={styles.sectionSubtitle}>간세포암(HCC) 상세 정보</h4>

                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>AJCC Stage</label>
                                            <input
                                                type="text"
                                                placeholder="예: I, II, III"
                                                className={styles.formInput}
                                                value={hccDetails.ajcc_stage}
                                                onChange={(e) => setHccDetails({ ...hccDetails, ajcc_stage: e.target.value })}
                                                disabled={disabled}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Tumor Status</label>
                                            <input
                                                type="text"
                                                placeholder="T1, T2..."
                                                className={styles.formInput}
                                                value={hccDetails.tumor_status}
                                                onChange={(e) => setHccDetails({ ...hccDetails, tumor_status: e.target.value })}
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                    {/* 추가 필드들은 복잡성을 줄이기 위해 일부 생략하거나 필요시 추가 */}
                                </div>
                            )}

                            <div className={styles.buttonGroup}>
                                {onCancel && (
                                    <button
                                        className={styles.cancelButton}
                                        onClick={onCancel}
                                        disabled={disabled}
                                        style={{ marginRight: 'auto', background: '#FF5252', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >
                                        진료 취소
                                    </button>
                                )}
                                <button
                                    className={styles.tempSaveButton}
                                    onClick={onTempSave}
                                    disabled={disabled}
                                >
                                    임시저장
                                </button>
                                <button
                                    className={styles.submitButton}
                                    onClick={onComplete}
                                    disabled={disabled}
                                >
                                    진료완료
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.formSection}>
                            {/* 처방전 UI */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>처방 약물</label>
                                {medications.map((med, index) => (
                                    <div key={index} style={{ position: 'relative', marginBottom: '8px' }}>
                                        <div className={styles.prescriptionRow}>
                                            <input
                                                type="text"
                                                placeholder="약물명 검색..."
                                                value={searchIndex === index ? searchQuery : med.name}
                                                onChange={(e) => {
                                                    setSearchIndex(index);
                                                    setSearchQuery(e.target.value);
                                                    onMedicationChange?.(index, 'name', e.target.value);
                                                }}
                                                onFocus={() => {
                                                    setSearchIndex(index);
                                                    setSearchQuery(med.name);
                                                }}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                disabled={disabled}
                                            />
                                            <input type="text" placeholder="용량" value={med.dosage} onChange={(e) => onMedicationChange?.(index, 'dosage', e.target.value)} disabled={disabled} />
                                            <input type="text" placeholder="복용법" value={med.frequency} onChange={(e) => onMedicationChange?.(index, 'frequency', e.target.value)} disabled={disabled} />
                                            <input type="number" placeholder="일수" value={med.days} onChange={(e) => onMedicationChange?.(index, 'days', e.target.value)} disabled={disabled} />
                                            <button className={styles.deleteButton} onClick={() => onRemoveMedication?.(index)} disabled={disabled}>✕</button>
                                        </div>
                                        {/* 자동완성 드롭다운 */}
                                        {searchIndex === index && showSuggestions && suggestions.length > 0 && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                                background: '#FFF', border: '1px solid #E0E0E0', borderRadius: '8px',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto'
                                            }}>
                                                {suggestions.map((drug, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => handleSelectDrug(drug)}
                                                        style={{
                                                            padding: '10px 12px', cursor: 'pointer',
                                                            borderBottom: i < suggestions.length - 1 ? '1px solid #F0F0F0' : 'none'
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F5F3FF')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.background = '#FFF')}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>{drug.item_name}</div>
                                                        <div style={{ fontSize: '12px', color: '#888' }}>{drug.name_kr} | {drug.name_en}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button className={styles.addButton} onClick={onAddMedication} disabled={disabled} style={{ flex: 1 }}>+ 약물 추가</button>
                                    <button
                                        onClick={handleDDICheck}
                                        disabled={disabled || ddiLoading || medications.filter(m => m.name).length < 2}
                                        style={{
                                            padding: '10px 16px', background: '#6B58B1', color: '#FFF',
                                            border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                                            opacity: medications.filter(m => m.name).length < 2 ? 0.5 : 1
                                        }}
                                    >
                                        {ddiLoading ? '분석 중...' : 'DDI 검사'}
                                    </button>
                                </div>
                            </div>

                            {/* DDI 결과 배너 */}
                            {ddiSummary && (
                                <div style={{
                                    padding: '16px', borderRadius: '12px', marginTop: '8px',
                                    background: ddiSummary.hasInteraction
                                        ? ddiSummary.maxLevel === 'CRITICAL' ? '#FEF2F2' : '#FFF7ED'
                                        : '#F0FDF4',
                                    border: `2px solid ${ddiSummary.hasInteraction
                                        ? ddiSummary.maxLevel === 'CRITICAL' ? '#EF4444' : '#F97316'
                                        : '#10B981'}`
                                }}>
                                    {ddiSummary.hasInteraction ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '20px' }}>⚠️</span>
                                                <span style={{
                                                    fontWeight: 700, fontSize: '16px',
                                                    color: ddiSummary.maxLevel === 'CRITICAL' ? '#EF4444' : '#F97316'
                                                }}>
                                                    상호작용 {ddiSummary.count}건 감지
                                                </span>
                                            </div>
                                            {ddiSummary.interactions.map((int, i) => (
                                                <div key={i} style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: int.level === 'CRITICAL' ? '#EF4444' : int.level === 'MONITORING' ? '#F97316' : '#FACC15'
                                                    }}>
                                                        [{int.level}]
                                                    </span>
                                                    {' '}{int.drug1} + {int.drug2}: {int.summary}
                                                </div>
                                            ))}
                                            <button
                                                onClick={handleViewDetails}
                                                style={{
                                                    marginTop: '12px', padding: '8px 16px', background: '#6B58B1',
                                                    color: '#FFF', border: 'none', borderRadius: '6px',
                                                    fontWeight: 600, cursor: 'pointer', fontSize: '14px'
                                                }}
                                            >
                                                상세 분석 보기 →
                                            </button>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '20px' }}>✅</span>
                                            <span style={{ fontWeight: 600, fontSize: '16px', color: '#10B981' }}>
                                                상호작용 없음 - 안전한 처방입니다
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
