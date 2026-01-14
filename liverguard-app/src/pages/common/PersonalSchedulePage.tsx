import React, { useState, useEffect } from 'react';
import styles from './PersonalSchedule.module.css';
import { useAuth } from '../../context/AuthContext';
import {
    getDutySchedules,
    type DutyScheduleData,
    confirmDutySchedule,
    rejectDutySchedule
} from '../../api/hospitalOpsApi';
import { useWebSocketContext } from '../../context/WebSocketContext';

interface ScheduleModalProps {
    schedule: DutyScheduleData;
    onClose: () => void;
    onConfirm: () => void;
    onReject: (reason: string) => void;
}

const ScheduleReviewModal: React.FC<ScheduleModalProps> = ({ schedule, onClose, onConfirm, onReject }) => {
    const [reason, setReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const handleRejectClick = () => {
        setIsRejecting(true);
    };

    const handleSubmitReject = () => {
        if (!reason.trim()) {
            alert('거절 사유를 입력해주세요.');
            return;
        }
        onReject(reason);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>일정 확인</h3>
                    <button className={styles.modalClose} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.modalDetails}>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>날짜</span>
                        <span className={styles.detailValue}>
                            {new Date(schedule.start_time).toLocaleDateString()}
                        </span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>시간</span>
                        <span className={styles.detailValue}>
                            {new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~
                            {new Date(schedule.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>근무 유형</span>
                        <span className={styles.detailValue}>
                            {schedule.shift_type === 'DAY' ? '주간' :
                                schedule.shift_type === 'EVENING' ? '야간' :
                                    schedule.shift_type === 'NIGHT' ? '심야' : schedule.shift_type}
                        </span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>상태</span>
                        <span className={`${styles.itemStatus} ${styles[schedule.schedule_status?.toLowerCase() || '']}`}>
                            {schedule.schedule_status}
                        </span>
                    </div>

                    {(isRejecting || schedule.schedule_status === 'CANCELLED') && (
                        <div style={{ marginTop: '12px' }}>
                            <label className={styles.detailLabel}>거절 사유</label>
                            {schedule.schedule_status === 'CANCELLED' ? (
                                <div className={styles.detailValue} style={{ marginTop: '4px' }}>
                                    {schedule.rejection_reason || '사유 없음'}
                                </div>
                            ) : (
                                <textarea
                                    className={styles.reasonInput}
                                    placeholder="거절 사유를 입력하세요 (예: 개인 사정, 연차 등)"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    rows={3}
                                />
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.modalActions}>
                    {!isRejecting ? (
                        <>
                            {schedule.schedule_status === 'PENDING' && (
                                <>
                                    <button className={`${styles.btn} ${styles.btnReject}`} onClick={handleRejectClick}>거절/수정요청</button>
                                    <button className={`${styles.btn} ${styles.btnConfirm}`} onClick={onConfirm}>확정</button>
                                </>
                            )}
                            <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>닫기</button>
                        </>
                    ) : (
                        <>
                            <button className={`${styles.btn} ${styles.btnCancel}`} onClick={() => setIsRejecting(false)}>취소</button>
                            <button className={`${styles.btn} ${styles.btnReject}`} onClick={handleSubmitReject}>거절 제출</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function PersonalSchedulePage() {
    const { user } = useAuth();
    const { lastMessage } = useWebSocketContext();

    const [currentDate, setCurrentDate] = useState(new Date()); // Selected Date
    const [currentMonth, setCurrentMonth] = useState(new Date()); // Calendar View Month
    const [schedules, setSchedules] = useState<DutyScheduleData[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<DutyScheduleData | null>(null);

    // Derived State
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday start
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    useEffect(() => {
        if (user) {
            fetchSchedules();
        }
    }, [user, currentDate, currentMonth]); // Fetch broadly or optimize

    // Listen for WebSocket updates
    // Listen for WebSocket updates
    useEffect(() => {
        if (lastMessage) {
            const data = lastMessage;
            if (data.type === 'schedule_update') {
                // Refresh schedules
                fetchSchedules();
                // Optional: Show prompt or highlight
                // alert('일정이 업데이트되었습니다.'); // User might find annoying, maybe just refresh logic
            }
        }
    }, [lastMessage]);

    const fetchSchedules = async () => {
        if (!user) return;
        try {
            // Fetch for a wide range (e.g. current month + week buffer)
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);

            const data = await getDutySchedules(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0],
                user.id
            );
            setSchedules(data);
        } catch (error) {
            console.error("Failed to fetch schedules", error);
        }
    };

    const handleConfirm = async (schedule: DutyScheduleData) => {
        if (!schedule.schedule_id) return;
        try {
            await confirmDutySchedule(schedule.schedule_id);
            fetchSchedules();
            setSelectedSchedule(null);
        } catch (e) {
            alert('확인 중 오류가 발생했습니다.');
        }
    };

    const handleReject = async (schedule: DutyScheduleData, reason: string) => {
        if (!schedule.schedule_id) return;
        try {
            await rejectDutySchedule(schedule.schedule_id, reason);
            fetchSchedules();
            setSelectedSchedule(null);
        } catch (e) {
            alert('거절 처리 중 오류가 발생했습니다.');
        }
    };

    // Calendar Helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        return {
            daysInMonth: lastDay.getDate(),
            startingDay: firstDay.getDay(),
            prevMonthLastDay: new Date(year, month, 0).getDate()
        };
    };

    const renderCalendar = () => {
        const { daysInMonth, startingDay, prevMonthLastDay } = getDaysInMonth(currentMonth);
        const days = [];

        // Prev Month
        for (let i = startingDay - 1; i >= 0; i--) {
            days.push(<div key={`prev-${i}`} className={`${styles.day} ${styles.otherMonth}`}>{prevMonthLastDay - i}</div>);
        }

        // Current Month
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const isSelected = d.toDateString() === currentDate.toDateString();
            const isToday = d.toDateString() === new Date().toDateString();

            // Check events
            const hasEvent = schedules.some(s => new Date(s.start_time).toDateString() === d.toDateString());

            days.push(
                <div
                    key={i}
                    className={`${styles.day} ${isSelected ? styles.selected : ''} ${isToday ? styles.today : ''} ${hasEvent ? styles.hasEvent : ''}`}
                    onClick={() => setCurrentDate(d)}
                >
                    {i}
                </div>
            );
        }

        // Next Month (Just fill grid to 35 or 42)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push(<div key={`next-${i}`} className={`${styles.day} ${styles.otherMonth}`}>{i}</div>);
        }

        return days;
    };

    const renderDailySummary = () => {
        const daySchedules = schedules.filter(s =>
            new Date(s.start_time).toDateString() === currentDate.toDateString()
        ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        return (
            <div className={styles.summaryList}>
                {daySchedules.length === 0 ? (
                    <div style={{ color: '#a0aec0', textAlign: 'center', marginTop: '20px' }}>일정이 없습니다.</div>
                ) : (
                    daySchedules.map(sch => (
                        <div
                            key={sch.schedule_id}
                            className={`${styles.summaryItem} ${styles[sch.schedule_status?.toLowerCase() || '']}`}
                            onClick={() => setSelectedSchedule(sch)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className={styles.itemTime}>
                                {new Date(sch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                {new Date(sch.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className={styles.itemTitle}>
                                {sch.shift_type === 'DAY' ? '주간 근무' :
                                    sch.shift_type === 'EVENING' ? '야간 근무' : '심야 근무'}
                            </div>
                            <span className={`${styles.itemStatus} ${styles[sch.schedule_status?.toLowerCase() || '']}`}>
                                {sch.schedule_status}
                            </span>
                        </div>
                    ))
                )}
            </div>
        );
    };

    const renderTimetable = () => {
        const hours = Array.from({ length: 24 }, (_, i) => i);

        return (
            <div className={styles.timetableGrid}>
                {/* Header */}
                <div className={styles.gridHeader}>
                    <div className={styles.timeColHeader}></div>
                    {weekDates.map((d, i) => (
                        <div key={i} className={styles.dayHeader}>
                            {['일', '월', '화', '수', '목', '금', '토'][d.getDay()]} ({d.getDate()})
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div className={styles.gridBody}>
                    {/* Time Labels */}
                    <div className={styles.timeCol}>
                        {hours.map(h => (
                            <div key={h} className={styles.timeLabel} style={{ height: '60px' }}>
                                {h}:00
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {weekDates.map((d, dayIndex) => {
                        // Schedules for this day
                        const daySchedules = schedules.filter(s => {
                            const sDate = new Date(s.start_time);
                            return sDate.getDate() === d.getDate() && sDate.getMonth() === d.getMonth();
                        });

                        return (
                            <div key={dayIndex} className={styles.dayCol}>
                                <div style={{ position: 'relative', height: `${24 * 60}px` }}>
                                    {/* Make sure height matches timeCol, assume 60px per hour */}

                                    {/* Render Slots (White for Duty) is hard with variable shifts. 
                                        Instead, render default gray background on col, and overlay White blocks for duty? 
                                        Or just render Event Blocks. User asked for "white for duty, gray for off".
                                        So default background is gray (set in CSS), and we render "Duty Slots" in white.
                                    */}

                                    {daySchedules.map(sch => {
                                        if (sch.schedule_status === 'CANCELLED') return null; // Don't show cancelled as duty slot logic? Or show as red/gray.

                                        const start = new Date(sch.start_time);
                                        const end = new Date(sch.end_time);
                                        // Calculate top and height
                                        const startHour = start.getHours() + start.getMinutes() / 60;
                                        let endHour = end.getHours() + end.getMinutes() / 60;
                                        if (end.getDate() !== start.getDate()) endHour += 24; // Handle next day crossing loosely for display

                                        const top = startHour * 60;
                                        const height = (endHour - startHour) * 60;

                                        return (
                                            <React.Fragment key={sch.schedule_id}>
                                                {/* White Background Slot */}
                                                <div
                                                    className={styles.dutySlot}
                                                    style={{ top: `${top}px`, height: `${height}px` }}
                                                />
                                                {/* Event Block Overlay */}
                                                <div
                                                    className={`${styles.eventBlock} ${styles[sch.schedule_status?.toLowerCase() || '']}`}
                                                    style={{ top: `${top}px`, height: `${height}px` }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSchedule(sch);
                                                    }}
                                                >
                                                    {sch.shift_type} ({sch.schedule_status})
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.scheduleContainer}>
            {/* Left Panel */}
            <div className={styles.leftPanel}>
                {/* Calendar */}
                <div className={`${styles.card} ${styles.calendarCard}`}>
                    <div className={styles.calendarHeader}>
                        <button className={styles.navButton} onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>&lt;</button>
                        <div className={styles.monthTitle}>
                            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                        </div>
                        <button className={styles.navButton} onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>&gt;</button>
                    </div>
                    <div className={styles.calendarGrid}>
                        {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d} className={styles.weekday}>{d}</div>)}
                        {renderCalendar()}
                    </div>
                </div>

                {/* Daily Summary */}
                <div className={`${styles.card} ${styles.dailySummaryCard}`}>
                    <div className={styles.summaryHeader}>
                        <div className={styles.summaryTitle}>
                            {currentDate.getDate()}일 일정
                        </div>
                    </div>
                    <div className={styles.tabButtons}>
                        <button className={`${styles.tabButton} ${styles.active}`}>일정</button>
                        <button className={styles.tabButton} onClick={() => alert('예약 탭은 준비 중입니다.')}>예약</button>
                        {/* Only schedule active for now as per plan */}
                    </div>
                    {renderDailySummary()}
                </div>
            </div>

            {/* Main Panel */}
            <div className={styles.mainPanel}>
                <div className={`${styles.card} ${styles.timetableCard}`}>
                    <div className={styles.timetableHeader}>
                        <div className={styles.weekTitle}>주간 시간표</div>
                        <div className={styles.controls}>
                            <button className={styles.todayBtn} onClick={() => setCurrentDate(new Date())}>오늘</button>
                        </div>
                    </div>
                    {renderTimetable()}
                </div>
            </div>

            {/* Modal */}
            {selectedSchedule && (
                <ScheduleReviewModal
                    schedule={selectedSchedule}
                    onClose={() => setSelectedSchedule(null)}
                    onConfirm={() => handleConfirm(selectedSchedule)}
                    onReject={(r) => handleReject(selectedSchedule, r)}
                />
            )}
        </div>
    );
}
