import { useState, useEffect } from 'react';
import { type PendingOrder } from '../../api/administrationApi';
import styles from './PatientActionModal.module.css'; // Reusing styles

interface VitalMeasurementModalProps {
    isOpen: boolean;
    order?: PendingOrder | null;
    patient?: { id: string; name: string; patientId?: string } | null;
    onClose: () => void;
    onSubmit: (data: VitalOrPhysicalData) => Promise<void>;
}

export interface VitalOrPhysicalData {
    // 바이탈 데이터
    systolic_bp?: number;
    diastolic_bp?: number;
    heart_rate?: number;
    body_temperature?: number;
    respiratory_rate?: number;

    // 신체계측 데이터
    height?: number;
    weight?: number;
    bmi?: number;
}

const VitalMeasurementModal: React.FC<VitalMeasurementModalProps> = ({
    isOpen,
    order,
    patient,
    onClose,
    onSubmit,
}) => {
    const [formData, setFormData] = useState<VitalOrPhysicalData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // 모달이 열릴 때 초기화
            setFormData({});
        }
    }, [isOpen, order]);

    if (!isOpen) return null;
    if (!order && !patient) return null;

    const isVitalOrder = order ? order.order_type === 'VITAL' : true;
    const isPhysicalOrder = order ? order.order_type === 'PHYSICAL' : false;

    const patientName = order?.patient_name || patient?.name || '';
    const patientId = order?.patient_id || patient?.patientId || patient?.id || '';

    const handleChange = (field: keyof VitalOrPhysicalData, value: string) => {
        const numValue = value === '' ? undefined : parseFloat(value);
        setFormData(prev => ({
            ...prev,
            [field]: numValue
        }));

        // BMI 자동 계산
        if (field === 'height' || field === 'weight') {
            const height = field === 'height' ? numValue : formData.height;
            const weight = field === 'weight' ? numValue : formData.weight;

            if (height && weight && height > 0) {
                const heightInMeters = height / 100;
                const bmi = weight / (heightInMeters * heightInMeters);
                setFormData(prev => ({
                    ...prev,
                    [field]: numValue,
                    bmi: parseFloat(bmi.toFixed(2))
                }));
            }
        }
    };

    const handleSubmit = async () => {
        // 검증
        if (isVitalOrder) {
            if (!formData.systolic_bp || !formData.diastolic_bp || !formData.heart_rate || !formData.body_temperature) {
                alert('모든 바이탈 측정 값을 입력해주세요.');
                return;
            }
        } else if (isPhysicalOrder) {
            if (!formData.height || !formData.weight) {
                alert('키와 몸무게를 입력해주세요.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error) {
            console.error('검사 데이터 제출 실패:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>
                        {isVitalOrder ? '바이탈 측정' : '신체 계측'} - {patientName}
                    </h3>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalBody}>
                    <div style={{ marginBottom: '15px', padding: '12px', background: '#F5F7FA', borderRadius: '6px', fontSize: '13px' }}>
                        <div><strong>환자:</strong> {patientName} ({patientId})</div>
                        {order && <div><strong>검사:</strong> {order.order_name}</div>}
                        {order && <div><strong>요청의사:</strong> {order.doctor_name}</div>}
                    </div>

                    {isVitalOrder && (
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>수축기 혈압 (mmHg) <span style={{ color: 'red' }}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="300"
                                        className={styles.input}
                                        value={formData.systolic_bp || ''}
                                        onChange={(e) => handleChange('systolic_bp', e.target.value)}
                                        placeholder="예: 120"
                                    />
                                    <span className={styles.unit}>mmHg</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>이완기 혈압 (mmHg) <span style={{ color: 'red' }}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="200"
                                        className={styles.input}
                                        value={formData.diastolic_bp || ''}
                                        onChange={(e) => handleChange('diastolic_bp', e.target.value)}
                                        placeholder="예: 80"
                                    />
                                    <span className={styles.unit}>mmHg</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>심박수 (bpm) <span style={{ color: 'red' }}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="1"
                                        min="30"
                                        max="200"
                                        className={styles.input}
                                        value={formData.heart_rate || ''}
                                        onChange={(e) => handleChange('heart_rate', e.target.value)}
                                        placeholder="예: 72"
                                    />
                                    <span className={styles.unit}>bpm</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>체온 (°C) <span style={{ color: 'red' }}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="30"
                                        max="45"
                                        className={styles.input}
                                        value={formData.body_temperature || ''}
                                        onChange={(e) => handleChange('body_temperature', e.target.value)}
                                        placeholder="예: 36.5"
                                    />
                                    <span className={styles.unit}>°C</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>호흡수 (회/분)</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="1"
                                        min="5"
                                        max="60"
                                        className={styles.input}
                                        value={formData.respiratory_rate || ''}
                                        onChange={(e) => handleChange('respiratory_rate', e.target.value)}
                                        placeholder="예: 16"
                                    />
                                    <span className={styles.unit}>회/분</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {isPhysicalOrder && (
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>키 (cm) <span style={{ color: 'red' }}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="50"
                                        max="250"
                                        className={styles.input}
                                        value={formData.height || ''}
                                        onChange={(e) => handleChange('height', e.target.value)}
                                        placeholder="예: 170.5"
                                    />
                                    <span className={styles.unit}>cm</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>몸무게 (kg) <span style={{ color: 'red' }}>*</span></label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="10"
                                        max="300"
                                        className={styles.input}
                                        value={formData.weight || ''}
                                        onChange={(e) => handleChange('weight', e.target.value)}
                                        placeholder="예: 65.0"
                                    />
                                    <span className={styles.unit}>kg</span>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>BMI (자동 계산)</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={styles.input}
                                        value={formData.bmi || ''}
                                        readOnly
                                        style={{ backgroundColor: '#F5F7FA', cursor: 'not-allowed' }}
                                        placeholder="키와 몸무게 입력시 자동 계산"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.modalFooter}>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? '처리 중...' : '검사 완료'}
                    </button>
                    <button
                        className={styles.cancelButton}
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VitalMeasurementModal;
