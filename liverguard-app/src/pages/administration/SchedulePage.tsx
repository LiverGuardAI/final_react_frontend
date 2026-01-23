import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './SchedulePage.module.css';
import { getAvailableDoctors, getAppAppointments, approveAppAppointment, rejectAppAppointment } from '../../api/receptionApi';
import { getAppointments, createAppointment, getDutySchedules, createEncounter } from '../../api/receptionApi';
import { usePatients } from '../../hooks/usePatients';
import { useWebSocketContext } from '../../context/WebSocketContext';

interface Doctor {
  doctor_id: number;
  user_id?: number;
  name: string;
  department: {
    dept_name: string;
  };
  room_number?: string;
}

interface Appointment {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  patient_name?: string;
  patient?: string;
  patient_id?: string;
  doctor?: number | { doctor_id: number; name: string };
  doctor_id?: number;
  doctor_name?: string;
  department?: string;
  status?: string;
  notes?: string;
  appointment_type?: string;
  has_encounter?: boolean;
}

interface DutySchedule {
  schedule_id: number;
  user: number; // doctor_id
  start_time: string;
  end_time: string;
  schedule_status: string;
  work_role: string;
  shift_type?: string;
}

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
  appointments: { [doctorId: number]: Appointment | null };
}

// 로컬 시간 기준으로 날짜를 YYYY-MM-DD 형식으로 변환 (UTC 변환 방지)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    daysInMonth: lastDay.getDate(),
    startingDayOfWeek: firstDay.getDay(),
    prevMonthLastDay: new Date(year, month, 0).getDate()
  };
};

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<number[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dutySchedules, setDutySchedules] = useState<DutySchedule[]>([]);
  const [loading, setLoading] = useState(false);

  // 시간대 탭 상태
  type TimeSlotPeriod = 'morning' | 'afternoon' | 'evening' | 'night';
  const [selectedPeriod, setSelectedPeriod] = useState<TimeSlotPeriod>(() => {
    // 현재 시간에 따라 자동으로 시간대 선택
    const currentHour = new Date().getHours();
    if (currentHour >= 9 && currentHour < 13) return 'morning';
    if (currentHour >= 13 && currentHour < 18) return 'afternoon';
    if (currentHour >= 18 && currentHour < 22) return 'evening';
    return 'night';
  });

  // 오른쪽 패널 탭 상태
  const [rightPanelTab, setRightPanelTab] = useState<'onsite' | 'app'>('onsite');

  // 앱 예약 승인 관련 상태
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [pendingAppointmentsDate, setPendingAppointmentsDate] = useState<string>(''); // 빈 값 = 전체 날짜

  // 캘린더 예약 클릭 모달 상태
  const [calendarModalAppointment, setCalendarModalAppointment] = useState<Appointment | null>(null);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);

  // 현장 예약 등록 폼 상태
  const [onsiteForm, setOnsiteForm] = useState({
    patient_id: '',
    patient_name: '',
    appointment_date: formatLocalDate(new Date()),
    appointment_time: '09:00',
    doctor_id: '',
    notes: ''
  });

  const { patients, fetchPatients } = usePatients();

  // WebSocket (Global Context 사용)
  const { lastMessage } = useWebSocketContext();

  // API 호출 함수들 (useCallback으로 메모이제이션)
  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAvailableDoctors();
      setDoctors(response.results || response);
      setSelectedDoctors((response.results || response).map((d: Doctor) => d.doctor_id));
    } catch (error) {
      console.error('의사 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAppointmentsForDate = useCallback(async (date: Date) => {
    try {
      const dateStr = formatLocalDate(date);
      console.log('📅 예약 조회 날짜:', dateStr);
      const response = await getAppointments({ date: dateStr });
      console.log('📋 조회된 예약:', response.results || response);
      setAppointments(response.results || response);
    } catch (error) {
      console.error('예약 조회 실패:', error);
    }
  }, []);

  const fetchPendingAppointments = useCallback(async (date?: string) => {
    try {
      const response = await getAppAppointments('대기', date || undefined);
      const appointments = response.appointments || [];
      setPendingAppointments(appointments);
    } catch (error) {
      console.error('대기중인 예약 조회 실패:', error);
    }
  }, []);

  const fetchSchedulesForDate = useCallback(async (date: Date) => {
    try {
      const dateStr = formatLocalDate(date);
      const response = await getDutySchedules(dateStr, dateStr);
      setDutySchedules(response);
    } catch (error) {
      console.error('근무 일정 조회 실패:', error);
    }
  }, []);

  // WebSocket 메시지 처리 (Global Context 사용 - 싱글톤 패턴)
  useEffect(() => {
    if (!lastMessage) return;

    console.log('📩 WebSocket 메시지 (SchedulePage):', lastMessage);

    if (lastMessage.type === 'queue_update' && lastMessage.data?.event_type === 'new_appointment') {
      console.log('🔔 새 예약 알림:', lastMessage.data.appointment);
      fetchPendingAppointments();
    }
  }, [lastMessage, fetchPendingAppointments]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchDoctors();
    fetchPendingAppointments(pendingAppointmentsDate);
    fetchPatients();
  }, [fetchDoctors, fetchPendingAppointments, fetchPatients, pendingAppointmentsDate]);

  // 앱 예약 날짜 필터 변경 시 재조회
  useEffect(() => {
    fetchPendingAppointments(pendingAppointmentsDate);
  }, [pendingAppointmentsDate, fetchPendingAppointments]);

  // 날짜 변경 시 예약 데이터 로드
  useEffect(() => {
    fetchAppointmentsForDate(selectedDate);
    fetchSchedulesForDate(selectedDate);
  }, [selectedDate, fetchAppointmentsForDate, fetchSchedulesForDate]);

  // 시간대별 시간 범위 정의
  const getPeriodTimeRange = (period: TimeSlotPeriod): { startHour: number; endHour: number; nextDay?: boolean } => {
    switch (period) {
      case 'morning':
        return { startHour: 9, endHour: 13 }; // 09:00 ~ 13:00
      case 'afternoon':
        return { startHour: 13, endHour: 18 }; // 13:00 ~ 18:00
      case 'evening':
        return { startHour: 18, endHour: 22 }; // 18:00 ~ 22:00
      case 'night':
        return { startHour: 22, endHour: 6, nextDay: true }; // 22:00 ~ 06:00 (+1일)
      default:
        return { startHour: 9, endHour: 13 };
    }
  };

  // 30분 단위 타임슬롯 생성 (시간대별 필터링) - useMemo로 메모이제이션
  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const { startHour, endHour, nextDay } = getPeriodTimeRange(selectedPeriod);

    if (nextDay) {
      // 심야 시간대: 22:00 ~ 23:59
      for (let hour = startHour; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          slots.push({ time, hour, minute, appointments: {} });
        }
      }
      // 다음 날 00:00 ~ 06:00
      for (let hour = 0; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          slots.push({ time, hour, minute, appointments: {} });
        }
      }
    } else {
      // 일반 시간대
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          slots.push({ time, hour, minute, appointments: {} });
        }
      }
    }

    return slots;
  }, [selectedPeriod]);

  // 타임슬롯에 예약 매핑 (승인된 예약만 캘린더에 표시) - useMemo로 메모이제이션
  const slotsWithAppointments = useMemo((): TimeSlot[] => {
    return timeSlots.map(slot => {
      const slotAppointments: { [doctorId: number]: Appointment | null } = {};

      selectedDoctors.forEach(doctorId => {
        const appointment = appointments.find(
          apt => {
            // doctor는 숫자(doctor_id) 또는 객체로 올 수 있음
            const aptDoctorId = typeof apt.doctor === 'number'
              ? apt.doctor
              : (apt.doctor as any)?.doctor_id || apt.doctor_id;
            // 승인된 예약(예약완료)만 캘린더에 표시
            return aptDoctorId === doctorId && apt.appointment_time === slot.time && apt.status === '예약완료';
          }
        );
        slotAppointments[doctorId] = appointment || null;
      });

      return {
        ...slot,
        appointments: slotAppointments
      };
    });
  }, [timeSlots, selectedDoctors, appointments]);

  // 의사 선택/해제
  const handleDoctorToggle = (doctorId: number) => {
    setSelectedDoctors(prev =>
      prev.includes(doctorId)
        ? prev.filter(id => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  // 모두 선택/해제 (근무 중인 의사만)
  const handleSelectAll = () => {
    // 근무 중인 의사 목록 필터링
    const onDutyDoctors = doctors.filter(doctor => {
      const doctorSchedules = dutySchedules.filter(
        s => s.user === doctor.doctor_id && s.schedule_status === 'CONFIRMED'
      );
      return doctorSchedules.length > 0;
    });

    const onDutyDoctorIds = onDutyDoctors.map(d => d.doctor_id);
    const allOnDutySelected = onDutyDoctorIds.every(id => selectedDoctors.includes(id));

    if (allOnDutySelected) {
      // 모든 근무 중인 의사가 선택되어 있으면 전체 해제
      setSelectedDoctors([]);
    } else {
      // 근무 중인 의사만 선택
      setSelectedDoctors(onDutyDoctorIds);
    }
  };

  // 휴일 여부 확인 (주말)

  const getDoctorUserId = (doctorId: number) => {
    return doctors.find(d => d.doctor_id === doctorId)?.user_id;
  };

  const isHoliday = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
  };

  // 근무시간 외 여부 확인
  // 근무시간 외 여부 확인 (Updated to use Duty Schedules)
  const getDoctorSchedules = (doctorId: number) => {
    const userId = getDoctorUserId(doctorId);
    if (!userId) return [];
    return dutySchedules.filter(s => s.user === userId && s.schedule_status === 'CONFIRMED');
  };

  const getDoctorShiftLabel = (doctorId: number) => {
    const schedules = getDoctorSchedules(doctorId);
    if (schedules.length === 0) return '\uD734\uBB34';
    const uniqueShiftTypes = Array.from(new Set(schedules.map(s => s.shift_type).filter(Boolean)));
    if (uniqueShiftTypes.length > 1) return '복수';
    const shiftType = uniqueShiftTypes[0];
    switch (shiftType) {
      case 'DAY':
        return '주간';
      case 'EVENING':
        return '야간';
      case 'NIGHT':
        return '심야';
      case 'OFF':
        return '휴무';
      default:
        return shiftType || '근무';
    }
  };

  const isWithinDutySchedule = (doctorId: number, dateStr: string, timeStr: string) => {
    const schedules = getDoctorSchedules(doctorId);
    if (schedules.length === 0) return false;

    const parts = timeStr.split(':');
    const hour = Number(parts[0]);
    const minute = Number(parts[1] || 0);
    const slotStart = new Date(dateStr);
    slotStart.setHours(hour, minute, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotStart.getMinutes() + 30);

    return schedules.some(s => {
      const start = new Date(s.start_time);
      const end = new Date(s.end_time);
      return start < slotEnd && end > slotStart;
    });
  };

  const isDoctorOffDuty = (doctorId: number, date: Date, hour: number, minute: number) => {
    const doctorSchedules = getDoctorSchedules(doctorId);

    if (doctorSchedules.length === 0) return true;

    const slotTime = new Date(date);
    slotTime.setHours(hour, minute, 0, 0);
    const slotEndTime = new Date(slotTime);
    slotEndTime.setMinutes(slotEndTime.getMinutes() + 30);

    const isOnDuty = doctorSchedules.some(s => {
      const start = new Date(s.start_time);
      const end = new Date(s.end_time);
      return start < slotEndTime && end > slotTime;
    });

    return !isOnDuty;
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    setOnsiteForm(prev => ({
      ...prev,
      appointment_date: formatLocalDate(newDate)
    }));
  };

  // 이전 달의 마지막 날짜들
  const prevMonthDays = [];
  const prevMonthLastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(prevMonthLastDay - i);
  }

  // 현재 달의 날짜들
  const currentMonthDays = [];
  for (let day = 1; day <= daysInMonth; day++) {
    currentMonthDays.push(day);
  }

  // 다음 달의 시작 날짜들
  const totalCells = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDays = [];
  const remainingCells = 35 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    nextMonthDays.push(day);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // 현장 예약 등록
  const handleOnsiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onsiteForm.patient_id || !onsiteForm.doctor_id) {
      alert('환자와 의사를 선택해주세요.');
      return;
    }

    try {
      const doctorId = Number(onsiteForm.doctor_id);
      if (!isWithinDutySchedule(doctorId, onsiteForm.appointment_date, onsiteForm.appointment_time)) {
        alert('해당 시간은 근무 일정이 아닙니다. 다른 시간으로 예약해주세요.');
        return;
      }
      await createAppointment({
        patient: onsiteForm.patient_id,
        doctor: doctorId,
        appointment_date: onsiteForm.appointment_date,
        appointment_time: onsiteForm.appointment_time,
        status: '예약완료',
        notes: onsiteForm.notes,
        appointment_type: '현장예약'
      });

      alert('예약이 등록되었습니다.');

      // 폼 초기화
      setOnsiteForm({
        patient_id: '',
        patient_name: '',
        appointment_date: formatLocalDate(selectedDate),
        appointment_time: '09:00',
        doctor_id: '',
        notes: ''
      });

      // 예약 목록 새로고침
      fetchAppointmentsForDate(selectedDate);
    } catch (error) {
      console.error('예약 등록 실패:', error);
      alert('예약 등록에 실패했습니다.');
    }
  };

  // 앱 예약 승인
  const handleApproveAppAppointment = async () => {
    if (!selectedAppointment) return;

    if (!window.confirm(`${selectedAppointment.patient_name || '환자'}님의 예약을 승인하시겠습니까?\n가장 가까운 빈 시간에 자동으로 배정됩니다.`)) {
      return;
    }

    try {
      const response = await approveAppAppointment(selectedAppointment.appointment_id);

      if (response.success) {
        alert(`예약이 승인되었습니다.\n배정 시간: ${response.appointment.appointment_time}`);
        setSelectedAppointment(null);

        // 목록 새로고침
        fetchPendingAppointments();
        fetchAppointmentsForDate(selectedDate);
      } else {
        alert(response.message || '예약 승인에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('예약 승인 실패:', error);
      alert(error.response?.data?.message || '예약 승인에 실패했습니다.');
    }
  };

  // 앱 예약 거절
  const handleRejectAppAppointment = async () => {
    if (!selectedAppointment) return;

    const reason = window.prompt('거절 사유를 입력해주세요:');
    if (reason === null) return; // 취소

    try {
      const response = await rejectAppAppointment(selectedAppointment.appointment_id, reason);

      if (response.success) {
        alert('예약이 거절되었습니다.');
        setSelectedAppointment(null);

        // 목록 새로고침
        fetchPendingAppointments();
      } else {
        alert(response.message || '예약 거절에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('예약 거절 실패:', error);
      alert(error.response?.data?.message || '예약 거절에 실패했습니다.');
    }
  };

  // 캘린더 예약 -> 진료 대기열 추가
  const handleAddToQueue = async () => {
    if (!calendarModalAppointment) return;

    setIsAddingToQueue(true);
    try {
      const now = new Date();
      // doctor가 객체인 경우 doctor_id 추출
      const doctorId = typeof calendarModalAppointment.doctor === 'object' && calendarModalAppointment.doctor !== null
        ? (calendarModalAppointment.doctor as { doctor_id: number }).doctor_id
        : (calendarModalAppointment.doctor as number) || 0;
      const encounterData = {
        patient: calendarModalAppointment.patient_id || calendarModalAppointment.patient || '',
        appointment: calendarModalAppointment.appointment_id, // 문진표 연결을 위해 필수
        doctor: doctorId,
        encounter_date: calendarModalAppointment.appointment_date,
        encounter_time: now.toTimeString().split(' ')[0].substring(0, 8),
        department: calendarModalAppointment.department || '',
        priority: 5,
        workflow_state: 'WAITING_CLINIC',
      };

      console.log('📋 진료 대기열 추가 요청:', encounterData);
      const response = await createEncounter(encounterData);
      console.log('✅ 진료 대기열 추가 응답:', response);

      alert('진료 대기열에 추가되었습니다.');
      setCalendarModalAppointment(null);
      // 예약 목록 새로고침하여 has_encounter 상태 업데이트
      fetchAppointmentsForDate(selectedDate);
    } catch (error: any) {
      console.error('진료 대기열 추가 실패:', error);
      alert(error.response?.data?.message || error.response?.data?.error || '진료 대기열 추가에 실패했습니다.');
    } finally {
      setIsAddingToQueue(false);
    }
  };

  return (
    <div className={styles.scheduleContainer}>
      <div className={styles.mainLayout}>
        {/* 왼쪽: 달력 + 의사 선택 */}
        <div className={styles.leftSection}>
          {/* 달력 */}
          <div className={styles.calendarCard}>
            <div className={styles.calendarHeader}>
              <button onClick={previousMonth} className={styles.navButton}>‹</button>
              <h3 className={styles.monthTitle}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button onClick={nextMonth} className={styles.navButton}>›</button>
            </div>

            <div className={styles.calendar}>
              <div className={styles.weekdays}>
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div key={day} className={styles.weekday}>{day}</div>
                ))}
              </div>

              <div className={styles.daysGrid}>
                {prevMonthDays.map((day, index) => (
                  <div key={`prev-${index}`} className={`${styles.day} ${styles.otherMonth}`}>
                    {day}
                  </div>
                ))}

                {currentMonthDays.map((day) => (
                  <div
                    key={day}
                    className={`${styles.day} ${isToday(day) ? styles.today : ''} ${isSelected(day) ? styles.selected : ''
                      }`}
                    onClick={() => handleDateClick(day)}
                  >
                    {day}
                  </div>
                ))}

                {nextMonthDays.map((day, index) => (
                  <div key={`next-${index}`} className={`${styles.day} ${styles.otherMonth}`}>
                    {day}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 의사 선택 */}
          <div className={styles.doctorSelectionCard}>
            <div className={styles.doctorSelectionHeader}>
              <h4 className={styles.doctorSelectionTitle}>의사 선택</h4>
              <button
                className={styles.selectAllButton}
                onClick={handleSelectAll}
              >
                {(() => {
                  const onDutyDoctors = doctors.filter(doctor => {
                    const doctorSchedules = dutySchedules.filter(
                      s => s.user === doctor.doctor_id && s.schedule_status === 'CONFIRMED'
                    );
                    return doctorSchedules.length > 0;
                  });
                  const onDutyDoctorIds = onDutyDoctors.map(d => d.doctor_id);
                  const allOnDutySelected = onDutyDoctorIds.every(id => selectedDoctors.includes(id));
                  return allOnDutySelected && onDutyDoctorIds.length > 0 ? '전체 해제' : '근무자 선택';
                })()}
              </button>
            </div>
            <div className={styles.doctorList}>
              {doctors.map(doctor => {
                // 해당 의사의 근무 일정 확인
                const doctorSchedules = dutySchedules.filter(
                  s => s.user === doctor.doctor_id && s.schedule_status === 'CONFIRMED'
                );
                const isOnDuty = doctorSchedules.length > 0;

                return (
                  <label
                    key={doctor.doctor_id}
                    className={styles.doctorCheckbox}
                    style={{ opacity: isOnDuty ? 1 : 0.5 }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDoctors.includes(doctor.doctor_id)}
                      onChange={() => handleDoctorToggle(doctor.doctor_id)}
                      disabled={!isOnDuty}
                    />
                    <span className={styles.doctorName}>
                      {doctor.name} ({doctor.department.dept_name})
                      {!isOnDuty && <span style={{ color: 'gray', fontSize: '0.85em' }}> - 근무 외</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* 중앙: 주간 일정표 */}
        <div className={styles.weekCalendarSection}>
          <div className={styles.weekCalendarCard}>
            <div className={styles.weekHeader}>
              <h3 className={styles.weekTitle}>
                {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
              </h3>
            </div>

            {/* 시간대 선택 탭 */}
            <div className={styles.periodTabs}>
              <button
                className={`${styles.periodTab} ${selectedPeriod === 'morning' ? styles.active : ''}`}
                onClick={() => setSelectedPeriod('morning')}
              >
                오전 (09:00~13:00)
              </button>
              <button
                className={`${styles.periodTab} ${selectedPeriod === 'afternoon' ? styles.active : ''}`}
                onClick={() => setSelectedPeriod('afternoon')}
              >
                오후 (13:00~18:00)
              </button>
              <button
                className={`${styles.periodTab} ${selectedPeriod === 'evening' ? styles.active : ''}`}
                onClick={() => setSelectedPeriod('evening')}
              >
                야간 (18:00~22:00)
              </button>
              <button
                className={`${styles.periodTab} ${selectedPeriod === 'night' ? styles.active : ''}`}
                onClick={() => setSelectedPeriod('night')}
              >
                심야 (22:00~06:00)
              </button>
            </div>

            {/* 의사별 컬럼 헤더 */}
            <div className={styles.weekDaysHeader}>
              <div className={styles.timeColumn}>시간</div>
              {selectedDoctors.map(doctorId => {
                const doctor = doctors.find(d => d.doctor_id === doctorId);
                const shiftLabel = getDoctorShiftLabel(doctorId);
                return (
                  <div key={doctorId} className={styles.doctorColumn}>
                    <div className={styles.doctorInfo}>
                      <div className={styles.doctorNameHeader}>{doctor?.name}</div>
                      <div className={styles.doctorDeptHeader}>{doctor?.department.dept_name}</div>
                      <div className={styles.doctorShiftHeader}>{shiftLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 시간 그리드 */}
            <div className={styles.scheduleGrid}>
              {slotsWithAppointments.map((slot, index) => (
                <div key={index} className={styles.timeSlotRow}>
                  <div className={styles.timeLabel}>{slot.time}</div>
                  {selectedDoctors.map(doctorId => {
                    const appointment = slot.appointments[doctorId];
                    const isGrayed = isDoctorOffDuty(doctorId, selectedDate, slot.hour, slot.minute);

                    return (
                      <div
                        key={doctorId}
                        className={`${styles.appointmentCell} ${isGrayed ? styles.grayedOut : ''}`}
                      >
                        {appointment ? (
                          <div
                            className={`${styles.appointmentBlock} ${appointment.has_encounter ? styles.inQueue : ''}`}
                            onClick={() => setCalendarModalAppointment(appointment)}
                            style={{
                              cursor: 'pointer',
                              backgroundColor: appointment.has_encounter ? '#e8f5e9' : undefined,
                              borderLeft: appointment.has_encounter ? '3px solid #4caf50' : undefined,
                            }}
                          >
                            <div className={styles.appointmentPatient}>
                              {appointment.patient_name || '환자'}
                            </div>
                            <div className={styles.appointmentStatus}>
                              {appointment.has_encounter ? '대기열 추가됨' : (appointment.status || '예약')}
                            </div>
                          </div>
                        ) : (
                          !isGrayed && <div className={styles.emptySlot}>-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽: 예약 관리 패널 */}
        <div className={styles.rightSection}>
          <div className={styles.rightPanelCard}>
            <div className={styles.rightPanelTabs}>
              <button
                className={`${styles.rightPanelTab} ${rightPanelTab === 'onsite' ? styles.active : ''}`}
                onClick={() => setRightPanelTab('onsite')}
              >
                현장 예약 등록
              </button>
              <button
                className={`${styles.rightPanelTab} ${rightPanelTab === 'app' ? styles.active : ''}`}
                onClick={() => setRightPanelTab('app')}
              >
                앱 예약 승인
              </button>
            </div>

            <div className={styles.rightPanelContent}>
              {rightPanelTab === 'onsite' ? (
                /* 현장 예약 등록 폼 */
                <form onSubmit={handleOnsiteSubmit} className={styles.onsiteForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>환자 선택</label>
                    <select
                      className={styles.formInput}
                      value={onsiteForm.patient_id}
                      onChange={(e) => setOnsiteForm({ ...onsiteForm, patient_id: e.target.value })}
                      required
                    >
                      <option value="">환자를 선택하세요</option>
                      {patients.map((patient: any) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.name} ({patient.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>의사 선택</label>
                    <select
                      className={styles.formInput}
                      value={onsiteForm.doctor_id}
                      onChange={(e) => setOnsiteForm({ ...onsiteForm, doctor_id: e.target.value })}
                      required
                    >
                      <option value="">의사를 선택하세요</option>
                      {doctors.map(doctor => {
                        // 해당 의사의 근무 일정 확인
                        const doctorSchedules = dutySchedules.filter(
                          s => s.user === doctor.doctor_id && s.schedule_status === 'CONFIRMED'
                        );
                        const isOnDuty = doctorSchedules.length > 0;

                        return (
                          <option
                            key={doctor.doctor_id}
                            value={doctor.doctor_id}
                            disabled={!isOnDuty}
                            style={{ color: isOnDuty ? 'black' : 'gray' }}
                          >
                            {doctor.name} ({doctor.department.dept_name}) {!isOnDuty ? '- 근무 외' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>예약 날짜</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={onsiteForm.appointment_date}
                      onChange={(e) => setOnsiteForm({ ...onsiteForm, appointment_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>예약 시간</label>
                    <select
                      className={styles.formInput}
                      value={onsiteForm.appointment_time}
                      onChange={(e) => setOnsiteForm({ ...onsiteForm, appointment_time: e.target.value })}
                      required
                    >
                      {timeSlots.map(slot => (
                        <option key={slot.time} value={slot.time}>
                          {slot.time}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>비고</label>
                    <textarea
                      className={styles.formTextarea}
                      value={onsiteForm.notes}
                      onChange={(e) => setOnsiteForm({ ...onsiteForm, notes: e.target.value })}
                      rows={3}
                      placeholder="증상이나 특이사항을 입력하세요"
                    />
                  </div>

                  <button type="submit" className={styles.submitButton}>
                    예약 등록
                  </button>
                </form>
              ) : (
                /* 앱 예약 승인 목록 */
                <div className={styles.appAppointmentsList}>
                  <div className={styles.listHeader}>
                    <h4 className={styles.listTitle}>승인 대기 중인 예약</h4>
                    <input
                      type="date"
                      className={styles.dateFilter}
                      value={pendingAppointmentsDate}
                      onChange={(e) => setPendingAppointmentsDate(e.target.value)}
                    />
                  </div>
                  {pendingAppointments.length === 0 ? (
                    <div className={styles.emptyList}>
                      승인 대기 중인 예약이 없습니다.
                    </div>
                  ) : (
                    <div className={styles.appointmentItems}>
                      {pendingAppointments.map(apt => (
                        <div
                          key={apt.appointment_id}
                          className={styles.appointmentItem}
                          onClick={() => setSelectedAppointment(apt)}
                        >
                          <div className={styles.appointmentItemHeader}>
                            <span className={styles.appointmentItemPatient}>
                              {apt.patient_name}
                            </span>
                            <span className={styles.appointmentItemStatus}>
                              대기
                            </span>
                          </div>
                          <div className={styles.appointmentItemDetails}>
                            <span className={styles.appointmentItemDateTime}>
                              📅 {apt.appointment_date} {apt.appointment_time}
                            </span>
                          </div>
                          <div className={styles.appointmentItemDetails}>
                            <span>👨‍⚕️ {apt.doctor_name || '미배정'}</span>
                            <span>🏥 {apt.department || '-'}</span>
                          </div>
                          {apt.notes && (
                            <div className={styles.appointmentItemNotes}>
                              💬 {apt.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAppointment && (
                    <div className={styles.approvalSection}>
                      <h4 className={styles.approvalTitle}>예약 승인/거절</h4>
                      <div className={styles.approvalDetails}>
                        <p><strong>환자:</strong> {selectedAppointment.patient_name}</p>
                        <p><strong>진료과:</strong> {selectedAppointment.department || '-'}</p>
                        <p><strong>의사:</strong> {selectedAppointment.doctor_name || '-'}</p>
                        <p><strong>예약 날짜:</strong> {selectedAppointment.appointment_date}</p>
                        <p><strong>요청 시간:</strong> {selectedAppointment.appointment_time}</p>
                        <p><strong>비고:</strong> {selectedAppointment.notes || '없음'}</p>
                      </div>
                      <div className={styles.approvalActions}>
                        <button
                          className={styles.approveButton}
                          onClick={handleApproveAppAppointment}
                        >
                          승인
                        </button>
                        <button
                          className={styles.rejectButton}
                          onClick={handleRejectAppAppointment}
                        >
                          거절
                        </button>
                        <button
                          className={styles.cancelButton}
                          onClick={() => setSelectedAppointment(null)}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 캘린더 예약 상세 모달 */}
      {calendarModalAppointment && (
        <div className={styles.modalOverlay} onClick={() => setCalendarModalAppointment(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>예약 정보</h3>
              <button
                className={styles.modalCloseButton}
                onClick={() => setCalendarModalAppointment(null)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>환자명</span>
                <span className={styles.modalValue}>{calendarModalAppointment.patient_name || '-'}</span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>환자 ID</span>
                <span className={styles.modalValue}>{calendarModalAppointment.patient_id || calendarModalAppointment.patient || '-'}</span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>예약일</span>
                <span className={styles.modalValue}>{calendarModalAppointment.appointment_date}</span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>예약시간</span>
                <span className={styles.modalValue}>{calendarModalAppointment.appointment_time}</span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>담당의</span>
                <span className={styles.modalValue}>{calendarModalAppointment.doctor_name || '-'}</span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>진료과</span>
                <span className={styles.modalValue}>{calendarModalAppointment.department || '-'}</span>
              </div>
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>상태</span>
                <span className={styles.modalValue}>{calendarModalAppointment.status || '-'}</span>
              </div>
              {calendarModalAppointment.notes && (
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>메모</span>
                  <span className={styles.modalValue}>{calendarModalAppointment.notes}</span>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              {calendarModalAppointment.has_encounter ? (
                <button
                  className={styles.approveButton}
                  disabled={true}
                  style={{ backgroundColor: '#9e9e9e', cursor: 'not-allowed' }}
                >
                  이미 대기열에 추가됨
                </button>
              ) : (
                <button
                  className={styles.approveButton}
                  onClick={handleAddToQueue}
                  disabled={isAddingToQueue}
                >
                  {isAddingToQueue ? '추가 중...' : '진료 대기열 추가'}
                </button>
              )}
              <button
                className={styles.cancelButton}
                onClick={() => setCalendarModalAppointment(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
