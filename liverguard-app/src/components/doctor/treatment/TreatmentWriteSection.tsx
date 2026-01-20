import React from 'react';
import styles from '../../../pages/doctor/TreatmentPage.module.css';

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
    medications?: { name: string; dosage: string; frequency: string; days: string }[];
    onAddMedication?: () => void;
    onRemoveMedication?: (index: number) => void;
    onMedicationChange?: (index: number, field: string, value: string) => void;
    onCancel?: () => void;
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
    onCancel
}: TreatmentWriteSectionProps) {

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
                            {/* 처방전 UI Placeholder */}
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>처방 약물</label>
                                {medications.map((med, index) => (
                                    <div key={index} className={styles.prescriptionRow} style={{ marginBottom: '8px' }}>
                                        <input type="text" placeholder="약물명" value={med.name} onChange={(e) => onMedicationChange?.(index, 'name', e.target.value)} disabled={disabled} />
                                        <input type="text" placeholder="용량" value={med.dosage} onChange={(e) => onMedicationChange?.(index, 'dosage', e.target.value)} disabled={disabled} />
                                        <input type="text" placeholder="복용법 (1일 3회)" value={med.frequency} onChange={(e) => onMedicationChange?.(index, 'frequency', e.target.value)} disabled={disabled} />
                                        <input type="number" placeholder="기간(일)" value={med.days} onChange={(e) => onMedicationChange?.(index, 'days', e.target.value)} disabled={disabled} />
                                        <button className={styles.deleteButton} onClick={() => onRemoveMedication?.(index)} disabled={disabled}>✕</button>
                                    </div>
                                ))}
                                <button className={styles.addButton} onClick={onAddMedication} disabled={disabled}>+ 약물 추가</button>
                            </div>

                            <div className={styles.buttonGroup}>
                                <button className={styles.tempSaveButton} onClick={onTempSave} disabled={disabled}>임시저장</button>
                                <button className={styles.submitButton} onClick={onComplete} disabled={disabled}>처방완료</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
