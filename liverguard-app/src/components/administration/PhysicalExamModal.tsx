import React, { useState } from 'react';
import styles from './PatientActionModal.module.css'; // Reusing styles

interface PhysicalExamModalProps {
    isOpen: boolean;
    patient: {
        id: string;
        name: string;
    } | null;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
}

const PhysicalExamModal: React.FC<PhysicalExamModalProps> = ({
    isOpen,
    patient,
    onClose,
    onSubmit,
}) => {
    const [formData, setFormData] = useState({
        height: '',
        weight: '',
        bmi: '',
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
                    <h3 className={styles.modalTitle}>신체 계측 - {patient.name}</h3>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label>키 (cm)</label>
                        <input
                            type="number"
                            value={formData.height}
                            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                            placeholder="cm"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>몸무게 (kg)</label>
                        <input
                            type="number"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            placeholder="kg"
                        />
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.saveBtn} onClick={handleSubmit}>저장</button>
                    <button className={styles.cancelButton} onClick={onClose}>취소</button>
                </div>
            </div>
        </div>
    );
};

export default PhysicalExamModal;
