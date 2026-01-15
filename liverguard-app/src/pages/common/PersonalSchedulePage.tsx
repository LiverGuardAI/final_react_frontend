import React, { useState, useEffect } from 'react';
import styles from './PersonalSchedule.module.css';
import { useAuth } from '../../context/AuthContext';
import {
    getDutySchedules,
    getPersonalSchedules,
    createPersonalSchedule,
    updatePersonalSchedule,
    deletePersonalSchedule,
    type DutyScheduleData,
    type PersonalScheduleData,
    confirmDutySchedule,
    rejectDutySchedule,
    createDutySchedule,
    updateDutySchedule,
    deleteDutySchedule
} from '../../api/hospitalOpsApi';
import { useWebSocketContext } from '../../context/WebSocketContext';
import ScheduleManagementModal from './ScheduleManagementModal';
import PersonalScheduleModal from './PersonalScheduleModal';

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

    const getShiftTypeLabel = (type?: string) => {
        switch (type) {
            case 'DAY': return '주간';
            case 'EVENING': return '저녁';
            case 'NIGHT': return '심야';
            case 'OFF': return '휴무';
            default: return type || '-';
        }
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
                            {getShiftTypeLabel(schedule.shift_type)}
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

    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [schedules, setSchedules] = useState<DutyScheduleData[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [personalSchedules, setPersonalSchedules] = useState<PersonalScheduleData[]>([]);
    const [selectedPersonalSchedule, setSelectedPersonalSchedule] = useState<PersonalScheduleData | null>(null);
    const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false);
    const [personalEditingData, setPersonalEditingData] = useState<PersonalScheduleData | null>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<DutyScheduleData | null>(null);
    const [dailyTab, setDailyTab] = useState<'schedule' | 'appointment'>('schedule');

    // Management Modal State
    const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
    const [managementMode, setManagementMode] = useState<'create' | 'edit'>('create');
    const [editingData, setEditingData] = useState<DutyScheduleData | null>(null);

    // 주간 날짜 계산
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    // 주간 기간 텍스트
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    const weekRangeText = `${weekStart.getFullYear()}년 ${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`;

    useEffect(() => {
        if (user) {
            fetchSchedules();
            fetchAppointments();
            fetchPersonalSchedules();
        }
    }, [user, currentDate, currentMonth]);

    // 자동 스크롤
    useEffect(() => {
        if (schedules.length > 0) {
            setTimeout(() => {
                const today = new Date();
                const todaySchedules = schedules.filter(s => {
                    const scheduleDate = new Date(s.start_time);
                    return scheduleDate.toDateString() === today.toDateString() &&
                        s.schedule_status === 'CONFIRMED';
                });

                const gridBody = document.getElementById('scheduleGridBody');
                if (!gridBody) return;

                if (todaySchedules.length > 0) {
                    const earliestSchedule = todaySchedules.sort((a, b) =>
                        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                    )[0];

                    const startTime = new Date(earliestSchedule.start_time);
                    const scrollMinutes = Math.max(0, startTime.getHours() * 60 + startTime.getMinutes() - 30);

                    gridBody.scrollTop = scrollMinutes * 50 / 30; // 30분당 50px
                } else {
                    const now = new Date();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    gridBody.scrollTop = Math.max(0, (currentMinutes - 60) * 50 / 30);
                }
            }, 100);
        }
    }, [schedules]);

    // WebSocket 업데이트 수신
    useEffect(() => {
        if (lastMessage) {
            const data = lastMessage;
            if (data.type === 'schedule_update') {
                fetchSchedules();
            }
        }
    }, [lastMessage]);

    const fetchSchedules = async () => {
        if (!user) return;
        try {
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);

            const userId = user?.user_id ?? user?.id;
            const data = await getDutySchedules(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0],
                userId
            );
            setSchedules(data);
        } catch (error) {
            console.error("Failed to fetch schedules", error);
        }
    };


    const fetchPersonalSchedules = async () => {
        if (!user) return;
        const isDoctor = user.role === 'doctor' || user.role === 'DOCTOR';
        if (!isDoctor) {
            setPersonalSchedules([]);
            return;
        }
        try {
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);
            const data = await getPersonalSchedules(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0]
            );
            setPersonalSchedules(data);
        } catch (error) {
            console.error("Failed to fetch personal schedules", error);
        }
    };

    const fetchAppointments = async () => {
        if (!user) return;

        // Appointment는 의사에게만 해당되는 데이터입니다.
        // 원무과(administration) 등 타 직군은 진료 예약 내역이 없으므로 조회하지 않습니다.
        const isDoctor = user.role === 'doctor' || user.role === 'DOCTOR';

        if (!isDoctor) {
            setAppointments([]);
            return;
        }

        try {
            // Import dynamically or assume it's available
            const { getAppointments } = await import('../../api/receptionApi');
            const doctorInfoRaw = localStorage.getItem('doctor');
            const doctorInfo = doctorInfoRaw ? JSON.parse(doctorInfoRaw) : null;
            const doctorId = doctorInfo?.doctor_id;

            if (!doctorId) {
                setAppointments([]);
                return;
            }
            const data = await getAppointments({
                doctor_id: String(doctorId),
                // Optimization: Fetch for current week or month range if API supports it
            });
            setAppointments(data.results || data);
        } catch (error) {
            console.error("Failed to fetch appointments", error);
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

    // Management Handlers
    const handleAddSchedule = () => {
        setManagementMode('create');
        setEditingData(null);
        setIsManagementModalOpen(true);
    };

    const handleEditSchedule = () => {
        if (!selectedSchedule) return;
        setManagementMode('edit');
        setEditingData(selectedSchedule);
        setIsManagementModalOpen(true);
    };

    const handleDeleteSchedule = async () => {
        if (!confirm('\uC815\uB9D0 \uC774 \uC77C\uC815\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
        try {
            await deleteDutySchedule(selectedSchedule.schedule_id);
            fetchSchedules();
            setSelectedSchedule(null);
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleManagementSubmit = async (data: Partial<DutyScheduleData>) => {
        if (!user) return;
        try {
            if (managementMode === 'create') {
                const userId = user?.user_id ?? user?.id;
                if (!userId) return;
                await createDutySchedule({ ...data, user: userId } as DutyScheduleData);
            } else if (managementMode === 'edit' && editingData?.schedule_id) {
                await updateDutySchedule(editingData.schedule_id, data);
            }
            setIsManagementModalOpen(false);
            fetchSchedules();
            setSelectedSchedule(null); // Close selection after edit
        } catch (error) {
            alert('저장 실패: ' + error);
        }
    };

    const getShiftTypeLabel = (type?: string) => {
        switch (type) {
            case 'DAY': return '주간';
            case 'EVENING': return '저녁';
            case 'NIGHT': return '심야';
            case 'OFF': return '휴무';
            default: return type || '';
        }
    };

    const getPersonalScheduleLabel = (type?: string) => {
        switch (type) {
            case 'CONFERENCE': return '\uD559\uD68C/\uC138\uBBF8\uB098';
            case 'VACATION': return '\uD734\uAC00';
            case 'OTHER': return '\uAE30\uD0C0';
            case 'OUTPATIENT': return '\uC678\uB798';
            case 'SURGERY': return '\uC218\uC220';
            default: return type || '-';
        }
    };

    // 달력 렌더링
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

        for (let i = startingDay - 1; i >= 0; i--) {
            days.push(<div key={`prev-${i}`} className={`${styles.day} ${styles.otherMonth}`}>{prevMonthLastDay - i}</div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const isSelected = d.toDateString() === currentDate.toDateString();
            const isToday = d.toDateString() === new Date().toDateString();
            const hasEvent = schedules.some(s => new Date(s.start_time).toDateString() === d.toDateString()) || personalSchedules.some(s => new Date(s.schedule_date).toDateString() === d.toDateString());

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

        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push(<div key={`next-${i}`} className={`${styles.day} ${styles.otherMonth}`}>{i}</div>);
        }

        return days;
    };

    // Daily Summary
    const renderDailySummary = () => {
        const daySchedules = schedules.filter(s =>
            new Date(s.start_time).toDateString() === currentDate.toDateString()
        ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        const dayPersonalSchedules = personalSchedules.filter(s =>
            new Date(s.schedule_date).toDateString() === currentDate.toDateString()
        ).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        const combinedSchedules = [
            ...daySchedules.map(sch => ({
                kind: 'duty' as const,
                start: new Date(sch.start_time),
                end: new Date(sch.end_time),
                schedule: sch
            })),
            ...dayPersonalSchedules.map(sch => ({
                kind: 'personal' as const,
                start: new Date(`${sch.schedule_date}T${sch.start_time || '00:00'}`),
                end: new Date(`${sch.schedule_date}T${sch.end_time || '00:00'}`),
                schedule: sch
            }))
        ].sort((a, b) => a.start.getTime() - b.start.getTime());
        const hasSelection = !!selectedSchedule || !!selectedPersonalSchedule;

        return (
            <>
                {/* ? ?? */}
                <div className={styles.tabButtons}>
                    <button
                        className={`${styles.tabButton} ${dailyTab === 'schedule' ? styles.active : ''}`}
                        onClick={() => setDailyTab('schedule')}
                    >
                        ??
                    </button>
                    <button
                        className={`${styles.tabButton} ${dailyTab === 'appointment' ? styles.active : ''}`}
                        onClick={() => setDailyTab('appointment')}
                    >
                        ??
                    </button>
                </div>

                {/* ?? ? ?? */}
                {dailyTab === 'schedule' ? (
                    <>
                        <div className={styles.summaryList}>
                            {combinedSchedules.length === 0 ? (
                                <div style={{ color: '#a0aec0', textAlign: 'center', marginTop: '20px' }}>??? ????.</div>
                            ) : (
                                combinedSchedules.map(item => {
                                    if (item.kind === 'duty') {
                                        const sch = item.schedule;
                                        return (
                                            <div
                                                key={`duty-${sch.schedule_id}`}
                                                className={`${styles.summaryItem} ${styles[sch.schedule_status?.toLowerCase() || '']}`}
                                                onClick={() => {
                                                    setSelectedPersonalSchedule(null);
                                                    setSelectedSchedule(sch);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={styles.itemTime}>
                                                    {new Date(sch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                    {new Date(sch.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className={styles.itemTitle}>
                                                    {getShiftTypeLabel(sch.shift_type)}
                                                </div>
                                                <span className={`${styles.itemStatus} ${styles[sch.schedule_status?.toLowerCase() || '']}`}>
                                                    {sch.schedule_status}
                                                </span>
                                            </div>
                                        );
                                    }
                                    const sch = item.schedule;
                                    return (
                                        <div
                                            key={`personal-${sch.schedule_id}`}
                                            className={styles.summaryItem}
                                            onClick={() => {
                                                setSelectedSchedule(null);
                                                setSelectedPersonalSchedule(sch);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className={styles.itemTime}>
                                                {sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)}
                                            </div>
                                            <div className={styles.itemTitle}>
                                                {getPersonalScheduleLabel(sch.schedule_type)}
                                            </div>
                                            <span className={styles.itemStatus}>??</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {/* ?? ?? ?? */}
                        <div className={styles.scheduleActions}>
                            <button className={styles.btnAdd} onClick={handleAddSchedule}>?? ?? ??</button>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => { setPersonalEditingData(null); setIsPersonalModalOpen(true); }}
                            >
                                ?? ?? ??
                            </button>
                            <button
                                className={styles.btnEdit}
                                disabled={!hasSelection}
                                onClick={() => {
                                    if (selectedPersonalSchedule) {
                                        setPersonalEditingData(selectedPersonalSchedule);
                                        setIsPersonalModalOpen(true);
                                        return;
                                    }
                                    handleEditSchedule();
                                }}
                            >
                                ??
                            </button>
                            <button
                                className={styles.btnDelete}
                                disabled={!hasSelection}
                                onClick={async () => {
                                    if (selectedPersonalSchedule?.schedule_id) {
                                        if (!confirm('?? ??????')) return;
                                        await deletePersonalSchedule(selectedPersonalSchedule.schedule_id);
                                        setSelectedPersonalSchedule(null);
                                        fetchPersonalSchedules();
                                        return;
                                    }
                                    handleDeleteSchedule();
                                }}
                            >
                                ??
                            </button>
                        </div>
                    </>
                ) : (
                    <div className={styles.summaryList}>

                        {appointments
                            .filter(apt => new Date(apt.appointment_date).toDateString() === currentDate.toDateString())
                            .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
                            .map((apt, idx) => (
                                <div key={idx} className={styles.summaryItem}>
                                    <div className={styles.itemTime}>
                                        {apt.appointment_time?.slice(0, 5)}
                                    </div>
                                    <div className={styles.itemTitle}>
                                        {apt.patient_name || apt.patient?.name} ({apt.status})
                                    </div>
                                    <div className={styles.itemStatus}>
                                        {apt.appointment_type}
                                    </div>
                                </div>
                            ))}
                        {appointments.filter(apt => new Date(apt.appointment_date).toDateString() === currentDate.toDateString()).length === 0 && (
                            <div style={{ color: '#a0aec0', textAlign: 'center', marginTop: '20px' }}>??? ????.</div>
                        )}
                    </div>
                )}
            </>
        );
    };


    // Timetable - appointments 스타일 (그리드)
    const renderTimetable = () => {
        const timeSlots = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                timeSlots.push({
                    hour,
                    minute,
                    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                });
            }
        }

        return (
            <div className={styles.scheduleGridContainer} id="scheduleGridBody">
                {/* 헤더 */}
                <div className={styles.weekDaysHeader}>
                    <div className={styles.timeColumn}>시간</div>
                    {weekDates.map((d, i) => (
                        <div key={i} className={styles.dayColumn}>
                            {['일', '월', '화', '수', '목', '금', '토'][d.getDay()]} ({d.getDate()})
                        </div>
                    ))}
                </div>

                {/* 각 30분 슬롯 */}
                {timeSlots.map((slot, index) => (
                    <div key={index} className={styles.timeSlotRow}>
                        <div className={styles.timeLabel}>{slot.time}</div>

                        {/* 각 요일 셀 */}
                        {weekDates.map((d, dayIndex) => {
                            const daySchedules = schedules.filter(s => {
                                const sDate = new Date(s.start_time);
                                return sDate.toDateString() === d.toDateString();
                            });

                            // 이 슬롯 시간에 해당하는 일정 찾기
                            const schedule = daySchedules.find(s => {
                                const start = new Date(s.start_time);
                                const startMinutes = start.getHours() * 60 + start.getMinutes();
                                const slotMinutes = slot.hour * 60 + slot.minute;
                                const end = new Date(s.end_time);
                                const endMinutes = end.getHours() * 60 + end.getMinutes();

                                return slotMinutes >= startMinutes && slotMinutes < endMinutes;
                            });

                            const isOff = schedule?.shift_type === 'OFF';
                            const hasSchedule = !!schedule && schedule.schedule_status !== 'CANCELLED';

                            // Appointments for this slot
                            const slotAppointments = appointments.filter(apt => {
                                if (new Date(apt.appointment_date).toDateString() !== d.toDateString()) return false;
                                const [aptH, aptM] = (apt.appointment_time || '00:00:00').split(':').map(Number);
                                const aptTime = aptH * 60 + aptM;
                                const slotTime = slot.hour * 60 + slot.minute;
                                return aptTime >= slotTime && aptTime < slotTime + 30; // 30 min slot logic
                            });

                            return (
                                <div
                                    key={dayIndex}
                                    className={`${styles.scheduleCell} ${hasSchedule ? styles.onDuty : styles.offDuty} ${isOff ? styles.dayOff : ''}`}
                                    onClick={() => schedule && setSelectedSchedule(schedule)}
                                >
                                    {schedule && schedule.schedule_status !== 'CANCELLED' && (
                                        <div className={styles.scheduleLabel}>
                                            {isOff ? '휴무' : getShiftTypeLabel(schedule.shift_type)}
                                        </div>
                                    )}
                                    {/* Appointment Indicators */}
                                    {slotAppointments.length > 0 && (
                                        <div className={styles.appointmentIndicator}>
                                            {slotAppointments.map((apt, i) => (
                                                <div key={i} className={styles.appointmentDot} title={`${apt.patient_name || apt.patient?.name} - ${apt.appointment_time?.slice(0, 5)}`} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.scheduleContainer}>
            {/* 왼쪽 패널 */}
            <div className={styles.leftPanel}>
                {/* 달력 */}
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
                    {renderDailySummary()}
                </div>
            </div>

            {/* 메인 패널 */}
            <div className={styles.mainPanel}>
                <div className={`${styles.card} ${styles.timetableCard}`}>
                    <div className={styles.timetableHeader}>
                        <div className={styles.weekTitle}>주간 시간표 ({weekRangeText})</div>
                        <div className={styles.controls}>
                            <button className={styles.todayBtn} onClick={() => setCurrentDate(new Date())}>오늘</button>
                        </div>
                    </div>
                    {renderTimetable()}
                </div>
            </div>

            {/* 모달 */}
            {selectedSchedule && (
                <ScheduleReviewModal
                    schedule={selectedSchedule}
                    onClose={() => setSelectedSchedule(null)}
                    onConfirm={() => handleConfirm(selectedSchedule)}
                    onReject={(r) => handleReject(selectedSchedule, r)}
                />
            )}
            {isManagementModalOpen && (
                <ScheduleManagementModal
                    isOpen={isManagementModalOpen}
                    onClose={() => setIsManagementModalOpen(false)}
                    onSubmit={handleManagementSubmit}
                    initialData={editingData}
                    userId={user?.user_id ?? user?.id ?? 0}
                />
            )}
            <PersonalScheduleModal
                isOpen={isPersonalModalOpen}
                onClose={() => setIsPersonalModalOpen(false)}
                initialData={personalEditingData}
                onSubmit={async (data) => {
                    try {
                        if (personalEditingData?.schedule_id) {
                            await updatePersonalSchedule(personalEditingData.schedule_id, data);
                        } else {
                            await createPersonalSchedule(data);
                        }
                        setIsPersonalModalOpen(false);
                        setPersonalEditingData(null);
                        fetchPersonalSchedules();
                    } catch (error) {
                        alert('\uAC1C\uC778 \uC77C\uC815 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
                    }
                }}
            />
        </div>
    );
}
