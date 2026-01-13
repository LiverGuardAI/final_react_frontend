// src/pages/administration/ScheduleManagementPage.tsx
import React, { useState, useEffect } from 'react';
import styles from './ScheduleManagement.module.css';
import { getDutySchedules, createDutySchedule, confirmDutySchedule, deleteDutySchedule, type DutyScheduleData } from '../../api/administrationApi';
import apiClient from '../../api/axiosConfig';

// Types
interface Staff {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    role: string; // DOCTOR, RADIOLOGIST, CLERK
    department?: string;
}

export default function ScheduleManagementPage() {
    const [currentDate, setCurrentDate] = useState(new Date()); // Start of the week
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [schedules, setSchedules] = useState<DutyScheduleData[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<Partial<DutyScheduleData>>({});

    // Drag State
    const [draggedStaff, setDraggedStaff] = useState<Staff | null>(null);

    useEffect(() => {
        fetchStaffList();
    }, []);

    useEffect(() => {
        fetchSchedules();
    }, [currentDate]);

    const fetchStaffList = async () => {
        try {
            const response = await apiClient.get('/accounts/staff/');
            setStaffList(response.data);
        } catch (error) {
            console.error("Failed to fetch staff list", error);
        }
    };

    const fetchSchedules = async () => {
        const startOfWeek = getStartOfWeek(currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        try {
            const data = await getDutySchedules(
                startOfWeek.toISOString().split('T')[0],
                endOfWeek.toISOString().split('T')[0]
            );
            setSchedules(data);
        } catch (error) {
            console.error("Failed to fetch schedules", error);
        }
    };

    const getStartOfWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        return new Date(d.setDate(diff));
    };

    const handlePrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    // Drag Handlers
    const handleDragStart = (e: React.DragEvent, staff: Staff) => {
        setDraggedStaff(staff);
        e.dataTransfer.setData('staff', JSON.stringify(staff));
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e: React.DragEvent, dayIndex: number, hour: number) => {
        e.preventDefault();
        if (!draggedStaff) return;

        // Calculate dropped date/time
        const startOfWeek = getStartOfWeek(currentDate);
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(targetDate.getDate() + dayIndex);
        targetDate.setHours(hour, 0, 0, 0);

        const endTime = new Date(targetDate);
        endTime.setHours(hour + 4); // Default 4 hour shift

        openCreateModal(draggedStaff, targetDate, endTime);
        setDraggedStaff(null);
    };

    const openCreateModal = (staff: Staff, start: Date, end: Date) => {
        setModalData({
            user: staff.id,
            user_name: `${staff.first_name} ${staff.last_name}`,
            work_role: staff.role as any,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            shift_type: 'DAY', // Default
        });
        setIsModalOpen(true);
    };

    const handleCreateSubmit = async () => {
        if (!modalData.user || !modalData.start_time || !modalData.end_time) return;
        try {
            await createDutySchedule(modalData as DutyScheduleData);
            setIsModalOpen(false);
            fetchSchedules();
        } catch (error) {
            alert("Failed to create schedule");
        }
    };

    // Rendering Helpers
    const renderTimeSlot = (dayIndex: number, hour: number) => {
        const startOfWeek = getStartOfWeek(currentDate);
        const slotDate = new Date(startOfWeek);
        slotDate.setDate(slotDate.getDate() + dayIndex);
        slotDate.setHours(hour, 0, 0, 0);

        // Find schedules that OVERLAP with this hour
        const matchingSchedules = schedules.filter(sch => {
            const start = new Date(sch.start_time);
            const end = new Date(sch.end_time);
            const slotTime = slotDate.getTime();
            const slotEnd = slotTime + 60 * 60 * 1000;
            // Simple overlap check
            return (start.getTime() < slotEnd && end.getTime() > slotTime);
        });

        return (
            <div
                className={styles.timeSlot}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, dayIndex, hour)}
            >
                {matchingSchedules.map(sch => (
                    <div
                        key={sch.schedule_id}
                        className={`${styles.scheduleItem} ${sch.schedule_status === 'CONFIRMED' ? styles.confirmed : styles.pending}`}
                        title={`${new Date(sch.start_time).toLocaleTimeString()} - ${new Date(sch.end_time).toLocaleTimeString()}`}
                    >
                        <div className={styles.scheduleName}>{sch.user_name}</div>
                        <div className={styles.scheduleRole}>{sch.shift_type} ({sch.work_role})</div>
                    </div>
                ))}
            </div>
        );
    };

    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00 to 20:00
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className={styles.container}>
            <div className={styles.sidebar}>
                <div className={styles.sidebarTitle}>직원 목록 (Drag)</div>
                <div className={styles.doctorList}>
                    {staffList.map(staff => (
                        <div
                            key={staff.id}
                            className={`${styles.doctorCard} ${styles[staff.role]}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, staff)}
                        >
                            <div className={styles.doctorName}>{staff.first_name} {staff.last_name}</div>
                            <div className={styles.doctorDept}>{staff.role}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.mainContent}>
                <div className={styles.header}>
                    <div className={styles.weekControls}>
                        <button className={styles.controlBtn} onClick={handlePrevWeek}>&lt;</button>
                        <span className={styles.weekTitle}>
                            {getStartOfWeek(currentDate).toLocaleDateString()} - Week
                        </span>
                        <button className={styles.controlBtn} onClick={handleNextWeek}>&gt;</button>
                    </div>
                    <h1>관리자용 근무 배정 (Drop to Assign)</h1>
                </div>

                <div className={styles.timetableGrid}>
                    <div className={styles.timeHeader}>Time</div>
                    {days.map((d, i) => <div key={i} className={styles.dayHeader}>{d}</div>)}

                    {hours.map(hour => (
                        <React.Fragment key={hour}>
                            <div className={styles.timeLabel}>{hour}:00</div>
                            {days.map((_, dayIndex) => (
                                <React.Fragment key={dayIndex}>
                                    {renderTimeSlot(dayIndex, hour)}
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3 className={styles.modalTitle}>일정 배정</h3>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>직원</label>
                            <div>{modalData.user_name}</div>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>시작 시간</label>
                            <input
                                type="datetime-local"
                                className={styles.input}
                                value={modalData.start_time ? new Date(modalData.start_time).toISOString().slice(0, 16) : ''}
                                onChange={e => setModalData({ ...modalData, start_time: new Date(e.target.value).toISOString() })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>종료 시간</label>
                            <input
                                type="datetime-local"
                                className={styles.input}
                                value={modalData.end_time ? new Date(modalData.end_time).toISOString().slice(0, 16) : ''}
                                onChange={e => setModalData({ ...modalData, end_time: new Date(e.target.value).toISOString() })}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>근무 유형</label>
                            <select
                                className={styles.select}
                                value={modalData.shift_type || 'DAY'}
                                onChange={e => setModalData({ ...modalData, shift_type: e.target.value })}
                            >
                                <option value="DAY">주간 (Day)</option>
                                <option value="NIGHT">야간 (Night)</option>
                                <option value="OFF">휴무 (Off)</option>
                            </select>
                        </div>
                        <div className={styles.modalActions}>
                            <button className={`${styles.btn} ${styles.btnCancel}`} onClick={() => setIsModalOpen(false)}>취소</button>
                            <button className={`${styles.btn} ${styles.btnSubmit}`} onClick={handleCreateSubmit}>배정</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
