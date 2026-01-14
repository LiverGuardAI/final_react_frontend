import React, { useEffect, useState } from 'react';
import styles from './PersonalSchedule.module.css';
import type { PersonalScheduleData } from '../../api/hospitalOpsApi';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: PersonalScheduleData) => void;
    initialData?: PersonalScheduleData | null;
}

export default function PersonalScheduleModal({ isOpen, onClose, onSubmit, initialData }: Props) {
    const [formData, setFormData] = useState<PersonalScheduleData>({
        schedule_date: '',
        schedule_type: 'CONFERENCE',
        start_time: '09:00',
        end_time: '18:00',
        notes: ''
    });

    useEffect(() => {
        if (!isOpen) return;
        if (initialData) {
            setFormData({
                schedule_id: initialData.schedule_id,
                schedule_date: initialData.schedule_date,
                schedule_type: initialData.schedule_type,
                start_time: initialData.start_time.slice(0, 5),
                end_time: initialData.end_time.slice(0, 5),
                notes: initialData.notes || ''
            });
            return;
        }
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        setFormData({
            schedule_date: `${yyyy}-${mm}-${dd}`,
            schedule_type: 'CONFERENCE',
            start_time: '09:00',
            end_time: '18:00',
            notes: ''
        });
    }, [isOpen, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>
                        {initialData ? '\uAC1C\uC778 \uC77C\uC815 \uC218\uC815' : '\uAC1C\uC778 \uC77C\uC815 \uCD94\uAC00'}
                    </h3>
                    <button className={styles.modalClose} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>{'\uC77C\uC790'}</label>
                        <input
                            type="date"
                            name="schedule_date"
                            className={styles.input}
                            value={formData.schedule_date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{'\uC720\uD615'}</label>
                        <select
                            name="schedule_type"
                            className={styles.select}
                            value={formData.schedule_type}
                            onChange={handleChange}
                        >
                            <option value="CONFERENCE">{'\uD559\uD68C/\uC138\uBBF8\uB098'}</option>
                            <option value="VACATION">{'\uD734\uAC00'}</option>
                            <option value="OTHER">{'\uAE30\uD0C0'}</option>
                            <option value="OUTPATIENT">{'\uC678\uB798'}</option>
                            <option value="SURGERY">{'\uC218\uC220'}</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{'\uC2DC\uC791 \uC2DC\uAC04'}</label>
                        <input
                            type="time"
                            name="start_time"
                            className={styles.input}
                            value={formData.start_time}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{'\uC885\uB8CC \uC2DC\uAC04'}</label>
                        <input
                            type="time"
                            name="end_time"
                            className={styles.input}
                            value={formData.end_time}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>{'\uBA54\uBAA8'}</label>
                        <textarea
                            name="notes"
                            className={styles.reasonInput}
                            value={formData.notes}
                            onChange={handleChange}
                            rows={3}
                        />
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>
                            {'\uCDE8\uC18C'}
                        </button>
                        <button type="submit" className={`${styles.btn} ${styles.btnConfirm}`}>
                            {initialData ? '\uC218\uC815' : '\uCD94\uAC00'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
