import React, { useState } from 'react';
import styles from './PatientActionModal.module.css'; // Reusing styles

interface VitalMeasurementModalProps {
    isOpen: boolean;
    patient: {
        id: string;
        name: string;
    } | null;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
}

const VitalMeasurementModal: React.FC<VitalMeasurementModalProps> = ({
    isOpen,
    patient,
    onClose,
    onSubmit,
}) => {
    const [formData, setFormData] = useState({
        sbp: '',
        dbp: '',
        pulse: '',
        temp: '',
    });

    if (!isOpen || !patient) return null;

    const handleSubmit = async () => {
        await onSubmit(formData);
        onClose();
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>바이탈 측정 - {patient.name}</h3>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>수축기 혈압 (SBP)</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={formData.sbp}
                                    onChange={(e) => setFormData({ ...formData, sbp: e.target.value })}
                                    placeholder="0"
                                />
                                <span className={styles.unit}>mmHg</span>
                            </div>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>이완기 혈압 (DBP)</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={formData.dbp}
                                    onChange={(e) => setFormData({ ...formData, dbp: e.target.value })}
                                    placeholder="0"
                                />
                                <span className={styles.unit}>mmHg</span>
                            </div>
                        </div>
                    </div>
                    {/* Add more fields as needed */}
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.saveBtn} onClick={handleSubmit}>저장</button>
                    <button className={styles.cancelButton} onClick={onClose}>취소</button>
                </div>
            </div>
        </div>
    );
};

export default VitalMeasurementModal;
