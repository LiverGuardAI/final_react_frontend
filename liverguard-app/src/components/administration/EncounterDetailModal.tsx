import React, { useEffect, useState } from 'react';
import styles from '../../pages/administration/HomePage.module.css';
import { getEncounterDetail, getPatientImagingOrders, getPatientLabOrders, type EncounterDetail, type ImagingOrder, type LabOrder } from '../../api/doctorApi';

interface EncounterDetailModalProps {
    isOpen: boolean;
    encounterId: number | null;
    patientName: string;
    onClose: () => void;
}

const EncounterDetailModal: React.FC<EncounterDetailModalProps> = ({
    isOpen,
    encounterId,
    patientName,
    onClose,
}) => {
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<EncounterDetail | null>(null);
    const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
    const [labOrders, setLabOrders] = useState<LabOrder[]>([]);

    useEffect(() => {
        async function fetchData() {
            if (!encounterId) return;
            setLoading(true);
            try {
                const data = await getEncounterDetail(encounterId);
                setDetail(data);

                // Fetch Orders and filter by encounter (if API returns patient_id inside detail, we use that)
                if (data.patient?.patient_id) {
                    const [imgRes, labRes] = await Promise.all([
                        getPatientImagingOrders(data.patient.patient_id),
                        getPatientLabOrders(data.patient.patient_id)
                    ]);

                    const encounterDate = data.encounter_date;

                    // Filter Imaging Orders
                    const relevantImg = imgRes.results.filter((o: any) => o.encounter === encounterId || o.ordered_at?.startsWith(encounterDate));
                    setImagingOrders(relevantImg);

                    // Filter Lab Orders (using created_at date match or encounter id if available)
                    // LabOrder might not have encounter field exposed in basic list if not serialized, but we can rely on date
                    const relevantLab = labRes.results.filter((o: any) => o.created_at?.startsWith(encounterDate));
                    setLabOrders(relevantLab);
                }

            } catch (err) {
                console.error("Failed to fetch encounter detail", err);
            } finally {
                setLoading(false);
            }
        }

        if (isOpen && encounterId) {
            fetchData();
        } else {
            setDetail(null);
            setImagingOrders([]);
        }
    }, [isOpen, encounterId]);

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                <div className={styles.modalHeader}>
                    <h2>진료 기록 상세 - {patientName}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.modalBody}>
                    {loading ? (
                        <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>
                    ) : detail ? (
                        <div className={styles.detailGrid} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* 기본 정보 */}
                            <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                                <h3 style={{ marginTop: 0, fontSize: '1.1rem', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>기본 정보</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                    <div><strong>진료일시:</strong> {detail.encounter_date} {detail.encounter_time}</div>
                                    <div><strong>담당의사:</strong> {detail.doctor_name}</div>
                                    <div><strong>진료상태:</strong> {detail.encounter_status_display}</div>
                                    <div>
                                        <strong>진단명:</strong>
                                        <span style={{ marginLeft: '8px', color: '#d32f2f', fontWeight: 'bold' }}>
                                            {detail.diagnosis_name || '미입력'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 주증상 & 상세내용 */}
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '8px' }}>
                                    진료 소견 & 기록
                                </h3>
                                <div style={{ marginTop: '15px' }}>
                                    <div style={{ marginBottom: '10px' }}>
                                        <strong style={{ display: 'block', marginBottom: '4px', color: '#34495e' }}>주증상 (C.C):</strong>
                                        <div style={{ padding: '8px', backgroundColor: '#ecf0f1', borderRadius: '4px' }}>
                                            {detail.chief_complaint || detail.questionnaire?.data?.chief_complaint || '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <strong style={{ display: 'block', marginBottom: '4px', color: '#34495e' }}>의사 소견 (Note):</strong>
                                        <pre style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', border: '1px solid #eee' }}>
                                            {detail.clinical_notes || '내용 없음'}
                                        </pre>
                                    </div>
                                </div>
                            </div>


                            {/* 진단 검사 오더 (Lab) */}
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#8e44ad', borderBottom: '2px solid #9b59b6', paddingBottom: '8px' }}>
                                    진단 검사 오더 (Lab)
                                </h3>
                                {labOrders.length > 0 ? (
                                    <table className={styles.patientTable} style={{ marginTop: '10px', width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f3e5f5' }}>
                                                <th style={{ padding: '10px', borderBottom: '2px solid #e1bee7', textAlign: 'left' }}>검사 구분</th>
                                                <th style={{ padding: '10px', borderBottom: '2px solid #e1bee7', textAlign: 'left' }}>세부 사항</th>
                                                <th style={{ padding: '10px', borderBottom: '2px solid #e1bee7', textAlign: 'left' }}>상태</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {labOrders.map(order => (
                                                <tr key={order.order_id} style={{ borderBottom: '1px solid #f3e5f5' }}>
                                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{order.order_type_display}</td>
                                                    <td style={{ padding: '10px' }}>
                                                        {order.order_notes ? (
                                                            // Notes가 JSON이거나 문자열일 수 있음
                                                            typeof order.order_notes === 'string'
                                                                ? order.order_notes
                                                                : JSON.stringify(order.order_notes)
                                                        ) : '-'}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            backgroundColor: order.status === 'COMPLETED' ? '#e8f5e9' : '#fff3e0',
                                                            color: order.status === 'COMPLETED' ? '#2e7d32' : '#f57c00',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '600'
                                                        }}>
                                                            {order.status_display}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div style={{ color: '#888', padding: '10px 0' }}>진단 검사 오더 내역이 없습니다.</div>
                                )}
                            </div>

                            {/* 처방/오더 내역 (영상검사) */}
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#27ae60', borderBottom: '2px solid #2ecc71', paddingBottom: '8px' }}>
                                    영상 검사 오더 (Imaging)
                                </h3>
                                {imagingOrders.length > 0 ? (
                                    <table className={styles.patientTable} style={{ marginTop: '10px', width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#e8f5e9' }}>
                                                <th style={{ padding: '10px', borderBottom: '2px solid #c8e6c9', textAlign: 'left' }}>검사명</th>
                                                <th style={{ padding: '10px', borderBottom: '2px solid #c8e6c9', textAlign: 'left' }}>부위</th>
                                                <th style={{ padding: '10px', borderBottom: '2px solid #c8e6c9', textAlign: 'left' }}>상태</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {imagingOrders.map(order => (
                                                <tr key={order.order_id} style={{ borderBottom: '1px solid #e8f5e9' }}>
                                                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{order.modality}</td>
                                                    <td style={{ padding: '10px' }}>{order.body_part || '-'}</td>
                                                    <td style={{ padding: '10px' }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            backgroundColor: order.status === 'COMPLETED' ? '#e8f5e9' : '#fff3e0',
                                                            color: order.status === 'COMPLETED' ? '#2e7d32' : '#f57c00',
                                                            fontSize: '0.85rem',
                                                            fontWeight: '600'
                                                        }}>
                                                            {order.status_display}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div style={{ color: '#888', padding: '10px 0' }}>영상 오더 내역이 없습니다.</div>
                                )}
                            </div>

                            {/* 문진표 데이터 (추가) */}
                            {detail.questionnaire && detail.questionnaire.data && (
                                <div style={{ backgroundColor: '#fff8e1', padding: '15px', borderRadius: '8px', border: '1px solid #ffe0b2' }}>
                                    <h3 style={{ marginTop: 0, fontSize: '1.1rem', borderBottom: '2px solid #ff9800', paddingBottom: '10px', color: '#e65100' }}>
                                        문진표 상세 (Questionnaire)
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                                        <div><strong>주증상:</strong> {detail.questionnaire.data.chief_complaint || '-'}</div>
                                        {detail.questionnaire.data.symptom_duration && <div><strong>기간:</strong> {detail.questionnaire.data.symptom_duration}</div>}
                                        {detail.questionnaire.data.pain_level !== undefined && <div><strong>통증:</strong> {detail.questionnaire.data.pain_level}/10</div>}

                                        {/* 증상 목록 */}
                                        {detail.questionnaire.data.symptoms && Object.values(detail.questionnaire.data.symptoms).some((v: any) => v === true) && (
                                            <div>
                                                <strong>증상 목록:</strong>
                                                {' '}
                                                {Object.entries(detail.questionnaire.data.symptoms)
                                                    .filter(([_, v]: [string, any]) => v === true)
                                                    .map(([k]) => k)
                                                    .join(', ')}
                                                {detail.questionnaire.data.symptoms.other && ` (기타: ${detail.questionnaire.data.symptoms.other})`}
                                            </div>
                                        )}

                                        {/* 과거력/가족력 등 */}
                                        {detail.questionnaire.data.medical_history && Object.values(detail.questionnaire.data.medical_history).some((v: any) => v === true) && (
                                            <div><strong>과거력:</strong> {Object.entries(detail.questionnaire.data.medical_history).filter(([_, v]: [string, any]) => v === true).map(([k]) => k).join(', ')}</div>
                                        )}
                                        {detail.questionnaire.data.family_history && <div><strong>가족력:</strong> {detail.questionnaire.data.family_history}</div>}
                                        {detail.questionnaire.data.medications && <div><strong>복용약물:</strong> {detail.questionnaire.data.medications}</div>}
                                        {detail.questionnaire.data.smoking && <div><strong>흡연:</strong> {detail.questionnaire.data.smoking === 'none' ? '비흡연' : detail.questionnaire.data.smoking}</div>}
                                        {detail.questionnaire.data.alcohol && <div><strong>음주:</strong> {detail.questionnaire.data.alcohol === 'none' ? '비음주' : detail.questionnaire.data.alcohol}</div>}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center' }}>데이터를 불러올 수 없습니다.</div>
                    )}

                    <div className={styles.modalActions}>
                        <button className={styles.cancelButton} onClick={onClose}>
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default EncounterDetailModal;
