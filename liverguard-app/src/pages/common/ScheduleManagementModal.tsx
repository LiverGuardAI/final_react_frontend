import React, { useState, useEffect } from 'react';
import styles from './PersonalSchedule.module.css';
import type { DutyScheduleData } from '../../api/hospitalOpsApi';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<DutyScheduleData>) => void;
    initialData?: DutyScheduleData | null;
    userId: number;
}

export default function ScheduleManagementModal({ isOpen, onClose, onSubmit, initialData, userId }: Props) {
    const [formData, setFormData] = useState<Partial<DutyScheduleData>>({
        shift_type: 'DAY',
        start_time: '',
        end_time: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    start_time: initialData.start_time, // Ensure ISO string matches input format if needed, but implementation handles it
                    end_time: initialData.end_time
                });
            } else {
                // Default to tomorrow 09:00
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0);
                const end = new Date(tomorrow);
                end.setHours(18, 0, 0, 0);

                setFormData({
                    user: userId,
                    work_role: 'DOCTOR', // Default
                    shift_type: 'DAY',
                    start_time: toLocalISOString(tomorrow),
                    end_time: toLocalISOString(end)
                });
            }
        }
    }, [isOpen, initialData, userId]);

    // Helper to format Date to input datetime-local string (YYYY-MM-DDTHH:mm)
    const toLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset() * 60000; //ms
        const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
        return localISOTime;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
                        {initialData ? '일정 수정' : '일정 추가'}
                    </h3>
                    <button className={styles.modalClose} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>근무 유형</label>
                        <select
                            name="shift_type"
                            className={styles.select}
                            value={formData.shift_type}
                            onChange={handleChange}
                        >
                            <option value="DAY">주간 (09:00 ~ 18:00)</option>
                            <option value="EVENING">저녁 (18:00 ~ 22:00)</option>
                            <option value="NIGHT">심야 (22:00 ~ 06:00)</option>
                            <option value="OFF">휴무</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>시작 시간</label>
                        <input
                            type="datetime-local"
                            name="start_time"
                            className={styles.input}
                            value={formData.start_time ? new Date(formData.start_time).toISOString().slice(0, 16) : ''}
                            onChange={e => setFormData({ ...formData, start_time: new Date(e.target.value).toISOString() })}
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>종료 시간</label>
                        <input
                            type="datetime-local"
                            name="end_time"
                            className={styles.input}
                            value={formData.end_time ? new Date(formData.end_time).toISOString().slice(0, 16) : ''}
                            onChange={e => setFormData({ ...formData, end_time: new Date(e.target.value).toISOString() })}
                            required
                        />
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>취소</button>
                        <button type="submit" className={`${styles.btn} ${styles.btnConfirm}`}>
                            {initialData ? '수정' : '추가'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
