import { useState, useEffect } from 'react';
import styles from './SchedulePage.module.css';
import { getAvailableDoctors } from '../../api/receptionApi';
import { getAppointments, createAppointment, updateAppointment, getDutySchedules } from '../../api/receptionApi';
import { usePatients } from '../../hooks/usePatients';

interface Doctor {
  doctor_id: number;
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
  doctor?: number;
  doctor_name?: string;
  status?: string;
  notes?: string;
}

interface DutySchedule {
  schedule_id: number;
  user: number; // doctor_id
  start_time: string;
  end_time: string;
  schedule_status: string;
  work_role: string;
}

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
  appointments: { [doctorId: number]: Appointment | null };
}

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<number[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dutySchedules, setDutySchedules] = useState<DutySchedule[]>([]);
  const [loading, setLoading] = useState(false);

  // 오른쪽 패널 탭 상태
  const [rightPanelTab, setRightPanelTab] = useState<'onsite' | 'app'>('onsite');

  // 앱 예약 승인 관련 상태
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // 현장 예약 등록 폼 상태
  const [onsiteForm, setOnsiteForm] = useState({
    patient_id: '',
    patient_name: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '09:00',
    doctor_id: '',
    notes: ''
  });

  const { patients, fetchPatients } = usePatients();

  // 초기 데이터 로드
  useEffect(() => {
    fetchDoctors();
    fetchPendingAppointments();
    fetchPatients();
  }, []);

  // 날짜 변경 시 예약 데이터 로드
  useEffect(() => {
    fetchAppointmentsForDate(selectedDate);
    fetchSchedulesForDate(selectedDate);
  }, [selectedDate]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await getAvailableDoctors();
      setDoctors(response.results || response);
      // 기본적으로 모든 의사 선택
      setSelectedDoctors((response.results || response).map((d: Doctor) => d.doctor_id));
    } catch (error) {
      console.error('의사 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointmentsForDate = async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await getAppointments({ date: dateStr });
      setAppointments(response.results || response);
    } catch (error) {
      console.error('예약 조회 실패:', error);
    }
  };

  const fetchPendingAppointments = async () => {
    try {
      const response = await getAppointments({ status: '요청' });
      setPendingAppointments(response.results || response);
    } catch (error) {
      console.error('대기중인 예약 조회 실패:', error);
    }
  };

  const fetchSchedulesForDate = async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await getDutySchedules(dateStr, dateStr);
      setDutySchedules(response);
    } catch (error) {
      console.error('근무 일정 조회 실패:', error);
    }
  };

  // 30분 단위 타임슬롯 생성 (00:00 ~ 24:00) - 24시간 전체 표시
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        slots.push({
          time,
          hour,
          minute,
          appointments: {}
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // 타임슬롯에 예약 매핑
  const getSlotsWithAppointments = (): TimeSlot[] => {
    return timeSlots.map(slot => {
      const slotAppointments: { [doctorId: number]: Appointment | null } = {};

      selectedDoctors.forEach(doctorId => {
        const appointment = appointments.find(
          apt => apt.doctor === doctorId && apt.appointment_time === slot.time
        );
        slotAppointments[doctorId] = appointment || null;
      });

      return {
        ...slot,
        appointments: slotAppointments
      };
    });
  };

  const slotsWithAppointments = getSlotsWithAppointments();

  // 의사 선택/해제
  const handleDoctorToggle = (doctorId: number) => {
    setSelectedDoctors(prev =>
      prev.includes(doctorId)
        ? prev.filter(id => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  // 모두 선택/해제
  const handleSelectAll = () => {
    if (selectedDoctors.length === doctors.length) {
      setSelectedDoctors([]);
    } else {
      setSelectedDoctors(doctors.map(d => d.doctor_id));
    }
  };

  // 휴일 여부 확인 (주말)
  const isHoliday = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
  };

  // 근무시간 외 여부 확인
  // 근무시간 외 여부 확인 (Updated to use Duty Schedules)
  const isDoctorOffDuty = (doctorId: number, date: Date, hour: number) => {
    // Find schedules for this doctor on this day
    // Note: dutySchedules are already filtered for the day by fetch call
    const doctorSchedules = dutySchedules.filter(s => s.user === doctorId && s.schedule_status === 'CONFIRMED');

    if (doctorSchedules.length === 0) return true; // No schedule = Off duty

    // Check if hour is within any schedule
    // Create time for the slot
    const slotTime = new Date(date);
    slotTime.setHours(hour, 0, 0, 0);
    const slotEndTime = new Date(date);
    slotEndTime.setHours(hour + 1, 0, 0, 0);

    const isOnDuty = doctorSchedules.some(s => {
      const start = new Date(s.start_time);
      const end = new Date(s.end_time);
      // Check overlap: Start < SlotEnd AND End > SlotStart
      return start < slotEndTime && end > slotTime;
    });

    return !isOnDuty;
  };

  // 달력 관련 함수들
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
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
      appointment_date: newDate.toISOString().split('T')[0]
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
      await createAppointment({
        patient: onsiteForm.patient_id,
        doctor: Number(onsiteForm.doctor_id),
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
        appointment_date: selectedDate.toISOString().split('T')[0],
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
  const handleApproveAppointment = async () => {
    if (!selectedAppointment) return;

    try {
      await updateAppointment(selectedAppointment.appointment_id, {
        status: '승인완료'
      });

      alert('예약이 승인되었습니다.');
      setSelectedAppointment(null);

      // 목록 새로고침
      fetchPendingAppointments();
      fetchAppointmentsForDate(selectedDate);
    } catch (error) {
      console.error('예약 승인 실패:', error);
      alert('예약 승인에 실패했습니다.');
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
                {selectedDoctors.length === doctors.length ? '전체 해제' : '모두 선택'}
              </button>
            </div>
            <div className={styles.doctorList}>
              {doctors.map(doctor => (
                <label key={doctor.doctor_id} className={styles.doctorCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedDoctors.includes(doctor.doctor_id)}
                    onChange={() => handleDoctorToggle(doctor.doctor_id)}
                  />
                  <span className={styles.doctorName}>
                    {doctor.name} ({doctor.department.dept_name})
                  </span>
                </label>
              ))}
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

            {/* 의사별 컬럼 헤더 */}
            <div className={styles.weekDaysHeader}>
              <div className={styles.timeColumn}>시간</div>
              {selectedDoctors.map(doctorId => {
                const doctor = doctors.find(d => d.doctor_id === doctorId);
                return (
                  <div key={doctorId} className={styles.doctorColumn}>
                    <div className={styles.doctorInfo}>
                      <div className={styles.doctorNameHeader}>{doctor?.name}</div>
                      <div className={styles.doctorDeptHeader}>{doctor?.department.dept_name}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 시간 그리드 */}
            <div className={styles.scheduleGrid}>
              {slotsWithAppointments.map((slot, index) => {


                return (
                  <div key={index} className={styles.timeSlotRow}>
                    <div className={styles.timeLabel}>{slot.time}</div>
                    {selectedDoctors.map(doctorId => {
                      const appointment = slot.appointments[doctorId];
                      const isGrayed = isDoctorOffDuty(doctorId, selectedDate, slot.hour);

                      return (
                        <div
                          key={doctorId}
                          className={`${styles.appointmentCell} ${isGrayed ? styles.grayedOut : ''}`}
                        >
                          {appointment ? (
                            <div className={styles.appointmentBlock}>
                              <div className={styles.appointmentPatient}>
                                {appointment.patient_name || '환자'}
                              </div>
                              <div className={styles.appointmentStatus}>
                                {appointment.status || '예약'}
                              </div>
                            </div>
                          ) : (
                            !isGrayed && <div className={styles.emptySlot}>-</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
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
                      {doctors.map(doctor => (
                        <option key={doctor.doctor_id} value={doctor.doctor_id}>
                          {doctor.name} ({doctor.department.dept_name})
                        </option>
                      ))}
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
                  <h4 className={styles.listTitle}>승인 대기 중인 예약</h4>
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
                              {apt.patient_name || '환자'}
                            </span>
                            <span className={styles.appointmentItemDate}>
                              {apt.appointment_date}
                            </span>
                          </div>
                          <div className={styles.appointmentItemDetails}>
                            <span>{apt.appointment_time}</span>
                            <span>{apt.doctor_name || '의사 미배정'}</span>
                          </div>
                          <div className={styles.appointmentItemNotes}>
                            {apt.notes || '비고 없음'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAppointment && (
                    <div className={styles.approvalSection}>
                      <h4 className={styles.approvalTitle}>예약 승인</h4>
                      <div className={styles.approvalDetails}>
                        <p><strong>환자:</strong> {selectedAppointment.patient_name}</p>
                        <p><strong>날짜:</strong> {selectedAppointment.appointment_date}</p>
                        <p><strong>시간:</strong> {selectedAppointment.appointment_time}</p>
                      </div>
                      <div className={styles.approvalActions}>
                        <button
                          className={styles.approveButton}
                          onClick={handleApproveAppointment}
                        >
                          승인
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
    </div>
  );
}
