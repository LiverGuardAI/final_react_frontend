import { useState } from 'react';
import styles from './SchedulePage.module.css';

interface WeekEvent {
  id: number;
  day: number; // 0-6 (일-토)
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  title: string;
  color: string;
}

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date(2022, 10, 25)); // November 25, 2022
  const [currentMonth, setCurrentMonth] = useState(new Date(2022, 10, 1)); // November 2022
  const [currentWeekStart] = useState(new Date(2022, 10, 21)); // Week starting Nov 21

  // 샘플 주간 일정 데이터 (파스텔 톤 색상)
  const [weekEvents] = useState<WeekEvent[]>([
    { id: 1, day: 1, startHour: 8, startMinute: 0, durationMinutes: 60, title: 'Monday Wake-Up Hour', color: '#B4D7F1' },
    { id: 2, day: 1, startHour: 9, startMinute: 0, durationMinutes: 60, title: 'All-Team Kickoff', color: '#B4D7F1' },
    { id: 3, day: 1, startHour: 10, startMinute: 0, durationMinutes: 60, title: 'Financial Update', color: '#B4D7F1' },
    { id: 4, day: 1, startHour: 11, startMinute: 0, durationMinutes: 120, title: 'New Employee Welcome Lunch!', color: '#DCC6E0' },
    { id: 5, day: 1, startHour: 13, startMinute: 0, durationMinutes: 60, title: 'Design Review', color: '#B4D7F1' },
    { id: 6, day: 2, startHour: 8, startMinute: 0, durationMinutes: 60, title: 'Webinar: Acme Market...', color: '#B8DDD0' },
    { id: 7, day: 2, startHour: 9, startMinute: 0, durationMinutes: 60, title: 'Coffee Chat', color: '#B8DDD0' },
    { id: 8, day: 2, startHour: 14, startMinute: 0, durationMinutes: 180, title: 'Concept Design Review II', color: '#B4D7F1' },
    { id: 9, day: 3, startHour: 11, startMinute: 0, durationMinutes: 60, title: 'Onboarding Presentation', color: '#DCC6E0' },
    { id: 10, day: 3, startHour: 13, startMinute: 0, durationMinutes: 60, title: 'WIP Prioritization Workshop', color: '#B4D7F1' },
    { id: 11, day: 4, startHour: 13, startMinute: 0, durationMinutes: 60, title: 'Design Review', color: '#B4D7F1' },
    { id: 12, day: 4, startHour: 16, startMinute: 0, durationMinutes: 60, title: 'Design Team Happy Hour', color: '#F5C6C6' },
    { id: 13, day: 5, startHour: 12, startMinute: 0, durationMinutes: 60, title: 'Marketing Meet-and-Greet', color: '#FFD9A8' },
    { id: 14, day: 5, startHour: 14, startMinute: 0, durationMinutes: 60, title: '1:1 with Heather', color: '#FFD9A8' },
    { id: 15, day: 5, startHour: 16, startMinute: 0, durationMinutes: 60, title: 'Happy Hour', color: '#F5C6C6' },
  ]);

  // 샘플 예약 데이터
  interface Appointment {
    id: number;
    patientName: string;
    time: string;
    type: string;
  }

  const [appointments] = useState<Appointment[]>([
    { id: 1, patientName: '정예진', time: '09:00', type: '정기 검진' },
    { id: 2, patientName: '김철수', time: '11:00', type: '상담' },
    { id: 3, patientName: '이영희', time: '14:00', type: '재진' },
  ]);

  // 선택한 날짜의 요일 구하기 (주간 달력용)
  const getSelectedDayOfWeek = () => {
    const diff = Math.floor((selectedDate.getTime() - currentWeekStart.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff < 7 ? diff : -1;
  };

  // 선택한 날짜의 일정 필터링
  const selectedDayEvents = weekEvents.filter((event) => event.day === getSelectedDayOfWeek());

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
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
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
  const remainingCells = 35 - totalCells; // 5주 기준
  for (let day = 1; day <= remainingCells; day++) {
    nextMonthDays.push(day);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
      <div className={styles.scheduleContainer}>
      <div className={styles.mainLayout}>
        {/* 왼쪽: 달력 */}
        <div className={styles.calendarSection}>
          <div className={styles.calendarCard}>
            <div className={styles.calendarHeader}>
              <button onClick={previousMonth} className={styles.navButton}>‹</button>
              <h3 className={styles.monthTitle}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button onClick={nextMonth} className={styles.navButton}>›</button>
            </div>

            <div className={styles.calendar}>
              {/* 요일 헤더 */}
              <div className={styles.weekdays}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className={styles.weekday}>{day}</div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className={styles.daysGrid}>
                {/* 이전 달 날짜 */}
                {prevMonthDays.map((day, index) => (
                  <div key={`prev-${index}`} className={`${styles.day} ${styles.otherMonth}`}>
                    {day}
                  </div>
                ))}

                {/* 현재 달 날짜 */}
                {currentMonthDays.map((day) => (
                  <div
                    key={day}
                    className={`${styles.day} ${isToday(day) ? styles.today : ''} ${
                      isSelected(day) ? styles.selected : ''
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    {day}
                  </div>
                ))}

                {/* 다음 달 날짜 */}
                {nextMonthDays.map((day, index) => (
                  <div key={`next-${index}`} className={`${styles.day} ${styles.otherMonth}`}>
                    {day}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 선택한 날짜의 일정 */}
          <div className={styles.dailyScheduleCard}>
            <div className={styles.dailyScheduleHeader}>
              <h4 className={styles.dailyScheduleTitle}>
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
              </h4>
              <button className={styles.addEventButton} onClick={() => alert('일정 추가 기능은 준비중입니다')}>
                + 일정 추가
              </button>
            </div>

            <div className={styles.scheduleTabButtons}>
              <button className={styles.scheduleTabButton}>일정</button>
              <button className={styles.scheduleTabButton}>예약</button>
            </div>

            <div className={styles.dailyScheduleList}>
              {/* 일정 목록 */}
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => (
                  <div key={event.id} className={styles.scheduleItem} style={{ borderLeftColor: event.color }}>
                    <div className={styles.scheduleTime}>
                      {String(event.startHour).padStart(2, '0')}:{String(event.startMinute).padStart(2, '0')}
                    </div>
                    <div className={styles.scheduleContent}>
                      <div className={styles.scheduleItemTitle}>{event.title}</div>
                      <div className={styles.scheduleDuration}>{event.durationMinutes}분</div>
                    </div>
                    <div className={styles.scheduleActions}>
                      <button className={styles.editScheduleButton} onClick={() => alert('일정 수정 기능은 준비중입니다')}>수정</button>
                      <button className={styles.deleteScheduleButton} onClick={() => alert('일정 삭제 기능은 준비중입니다')}>삭제</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noSchedule}>일정이 없습니다</div>
              )}

              {/* 예약 목록 */}
              <div className={styles.appointmentSection}>
                <div className={styles.appointmentSectionTitle}>환자 예약</div>
                {appointments.map((apt) => (
                  <div key={apt.id} className={styles.appointmentItem}>
                    <div className={styles.appointmentTime}>{apt.time}</div>
                    <div className={styles.appointmentContent}>
                      <div className={styles.appointmentPatient}>{apt.patientName}</div>
                      <div className={styles.appointmentType}>{apt.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 주간 캘린더 */}
        <div className={styles.weekCalendarSection}>
          <div className={styles.weekCalendarCard}>
            {/* 주간 캘린더 헤더 */}
            <div className={styles.weekHeader}>
              <button className={styles.weekNavButton}>‹</button>
              <h3 className={styles.weekTitle}>WEEK</h3>
              <button className={styles.weekNavButton}>›</button>
              <button className={styles.todayButton}>Today</button>
            </div>

            {/* 요일 헤더 */}
            <div className={styles.weekDaysHeader}>
              <div className={styles.timeColumn}></div>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => {
                const dayDate = new Date(currentWeekStart);
                dayDate.setDate(currentWeekStart.getDate() + index);
                return (
                  <div key={day} className={styles.dayHeader}>
                    <div className={styles.dayName}>{day}</div>
                    <div className={styles.dayDate}>{dayDate.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* 시간 그리드 */}
            <div className={styles.weekGrid}>
              {/* 시간 라벨 */}
              <div className={styles.timeLabels}>
                {Array.from({ length: 11 }, (_, i) => i + 7).map((hour) => (
                  <div key={hour} className={styles.timeLabel}>
                    {hour} {hour < 12 ? 'AM' : 'PM'}
                  </div>
                ))}
              </div>

              {/* 각 요일별 컬럼 */}
              <div className={styles.daysGrid}>
                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                  <div key={dayIndex} className={styles.dayColumn}>
                    {/* 시간대별 그리드 라인 */}
                    {Array.from({ length: 11 }, (_, i) => (
                      <div key={i} className={styles.hourCell}></div>
                    ))}

                    {/* 이벤트들 */}
                    {weekEvents
                      .filter((event) => event.day === dayIndex)
                      .map((event) => {
                        const top = ((event.startHour - 7) * 60 + (event.startMinute / 60) * 60);
                        const height = (event.durationMinutes / 60) * 60;
                        return (
                          <div
                            key={event.id}
                            className={styles.eventBlock}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              backgroundColor: event.color,
                            }}
                          >
                            <div className={styles.eventTime}>
                              {String(event.startHour).padStart(2, '0')}:
                              {String(event.startMinute).padStart(2, '0')}{' '}
                              {event.startHour < 12 ? 'AM' : 'PM'}
                            </div>
                            <div className={styles.eventTitle}>{event.title}</div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
