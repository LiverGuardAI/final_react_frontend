// src/pages/administration/AppointmentManagementPage.tsx
import React, { useState } from "react";
import styles from "./AppointmentManagementPage.module.css";

interface AppointmentRequest {
  id: number;
  patientName: string;
  patientId: string;
  phone: string;
  gender: string;
  age: number;
  requestDate: string;
  requestTime: string;
  symptoms: string;
  preferredDate: string;
  preferredTime: string;
  status: "요청중" | "승인됨" | "거절됨";
  assignedDoctor?: string;
  assignedTime?: string;
}

interface Doctor {
  id: number;
  name: string;
  department: string;
  room: string;
}

interface DoctorSchedule {
  doctorId: number;
  doctorName: string;
  department: string;
  room: string;
  date: string;
  scheduleType: 'CLINIC' | 'SURGERY' | 'MEETING' | 'OFF' | 'VACATION';
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  currentAppointments: number;
  maxAppointments: number;
}

const AppointmentManagementPage: React.FC = () => {
  const [appointmentRequests, setAppointmentRequests] = useState<AppointmentRequest[]>([
    {
      id: 1,
      patientName: "김철수",
      patientId: "P2024001",
      phone: "010-1234-5678",
      gender: "남",
      age: 45,
      requestDate: "2024-12-20",
      requestTime: "14:30",
      symptoms: "우측 상복부 불편감, 피로감 지속, 소화불량",
      preferredDate: "2024-12-23",
      preferredTime: "10:00",
      status: "요청중",
    },
    {
      id: 2,
      patientName: "이영희",
      patientId: "P2024045",
      phone: "010-2345-6789",
      gender: "여",
      age: 52,
      requestDate: "2024-12-21",
      requestTime: "09:15",
      symptoms: "복부 팽만감, 식욕 저하, 간헐적 복통",
      preferredDate: "2024-12-23",
      preferredTime: "14:00",
      status: "요청중",
    },
    {
      id: 3,
      patientName: "박민수",
      patientId: "P2024023",
      phone: "010-3456-7890",
      gender: "남",
      age: 38,
      requestDate: "2024-12-21",
      requestTime: "16:45",
      symptoms: "황달 증상, 체중 감소, 전신 무력감",
      preferredDate: "2024-12-24",
      preferredTime: "09:00",
      status: "요청중",
    },
    {
      id: 4,
      patientName: "정수연",
      patientId: "P2024067",
      phone: "010-4567-8901",
      gender: "여",
      age: 60,
      requestDate: "2024-12-22",
      requestTime: "11:20",
      symptoms: "정기 검진 및 혈액 검사 상담 희망",
      preferredDate: "2024-12-24",
      preferredTime: "11:00",
      status: "승인됨",
    },
  ]);

  const [selectedRequest, setSelectedRequest] = useState<AppointmentRequest | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<AppointmentRequest | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // 샘플 의사 목록
  const [doctors] = useState<Doctor[]>([
    { id: 1, name: "정예진", department: "소화기내과", room: "101" },
    { id: 2, name: "송영운", department: "소화기내과", room: "102" },
    { id: 3, name: "김민수", department: "소화기내과", room: "103" },
  ]);

  // 샘플 의사 일정 (실제로는 API에서 가져와야 함)
  const [doctorSchedules] = useState<DoctorSchedule[]>([
    {
      doctorId: 1,
      doctorName: "정예진",
      department: "소화기내과",
      room: "101",
      date: "2024-12-23",
      scheduleType: "CLINIC",
      startTime: "09:00",
      endTime: "12:00",
      isAvailable: true,
      currentAppointments: 3,
      maxAppointments: 8,
    },
    {
      doctorId: 1,
      doctorName: "정예진",
      department: "소화기내과",
      room: "101",
      date: "2024-12-23",
      scheduleType: "CLINIC",
      startTime: "14:00",
      endTime: "17:00",
      isAvailable: true,
      currentAppointments: 2,
      maxAppointments: 8,
    },
    {
      doctorId: 2,
      doctorName: "송영운",
      department: "소화기내과",
      room: "102",
      date: "2024-12-23",
      scheduleType: "CLINIC",
      startTime: "09:00",
      endTime: "13:00",
      isAvailable: true,
      currentAppointments: 5,
      maxAppointments: 10,
    },
    {
      doctorId: 2,
      doctorName: "송영운",
      department: "소화기내과",
      room: "102",
      date: "2024-12-23",
      scheduleType: "SURGERY",
      startTime: "14:00",
      endTime: "18:00",
      isAvailable: false,
      currentAppointments: 0,
      maxAppointments: 0,
    },
    {
      doctorId: 3,
      doctorName: "김민수",
      department: "소화기내과",
      room: "103",
      date: "2024-12-23",
      scheduleType: "CLINIC",
      startTime: "10:00",
      endTime: "12:00",
      isAvailable: true,
      currentAppointments: 1,
      maxAppointments: 5,
    },
    {
      doctorId: 1,
      doctorName: "정예진",
      department: "소화기내과",
      room: "101",
      date: "2024-12-24",
      scheduleType: "CLINIC",
      startTime: "09:00",
      endTime: "12:00",
      isAvailable: true,
      currentAppointments: 2,
      maxAppointments: 8,
    },
  ]);

  const handleApproveClick = (request: AppointmentRequest) => {
    setAssigningRequest(request);
    setSelectedDate(request.preferredDate);
  };

  const handleReject = (id: number) => {
    setAppointmentRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === id ? { ...req, status: "거절됨" } : req
      )
    );
  };

  const handleViewDetails = (request: AppointmentRequest) => {
    setSelectedRequest(request);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
  };

  const handleCloseAssignModal = () => {
    setAssigningRequest(null);
    setSelectedDate("");
  };

  const handleAssignDoctor = (schedule: DoctorSchedule, timeSlot: string) => {
    if (!assigningRequest) return;

    setAppointmentRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === assigningRequest.id
          ? {
              ...req,
              status: "승인됨",
              assignedDoctor: schedule.doctorName,
              assignedTime: `${schedule.date} ${timeSlot}`,
            }
          : req
      )
    );
    handleCloseAssignModal();
  };

  const getSchedulesForDate = (date: string) => {
    return doctorSchedules.filter(schedule => schedule.date === date);
  };

  const getAvailableTimeSlots = (schedule: DoctorSchedule) => {
    if (!schedule.isAvailable || schedule.scheduleType !== 'CLINIC') return [];

    const slots: string[] = [];
    const start = parseInt(schedule.startTime.split(':')[0]);
    const end = parseInt(schedule.endTime.split(':')[0]);

    for (let hour = start; hour < end; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    return slots;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>앱 예약 요청 관리</h2>
        <div className={styles.stats}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>대기중</span>
            <span className={styles.statValue}>
              {appointmentRequests.filter(r => r.status === "요청중").length}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>승인됨</span>
            <span className={styles.statValue}>
              {appointmentRequests.filter(r => r.status === "승인됨").length}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>거절됨</span>
            <span className={styles.statValue}>
              {appointmentRequests.filter(r => r.status === "거절됨").length}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.requestTable}>
          <thead>
            <tr>
              <th>요청일시</th>
              <th>환자명</th>
              <th>환자번호</th>
              <th>연락처</th>
              <th>성별/나이</th>
              <th>희망 예약일시</th>
              <th>증상</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {appointmentRequests.map(request => (
              <tr key={request.id}>
                <td>
                  {request.requestDate}
                  <br />
                  <span className={styles.timeText}>{request.requestTime}</span>
                </td>
                <td className={styles.patientName}>{request.patientName}</td>
                <td>{request.patientId}</td>
                <td>{request.phone}</td>
                <td>
                  {request.gender} / {request.age}세
                </td>
                <td>
                  {request.preferredDate}
                  <br />
                  <span className={styles.timeText}>{request.preferredTime}</span>
                </td>
                <td>
                  <button
                    className={styles.symptomsButton}
                    onClick={() => handleViewDetails(request)}
                  >
                    증상 보기
                  </button>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[request.status]}`}>
                    {request.status}
                  </span>
                </td>
                <td>
                  <div className={styles.actionButtons}>
                    {request.status === "요청중" ? (
                      <>
                        <button
                          className={styles.approveBtn}
                          onClick={() => handleApproveClick(request)}
                        >
                          의사 배정
                        </button>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => handleReject(request.id)}
                        >
                          거절
                        </button>
                      </>
                    ) : request.status === "승인됨" ? (
                      <span className={styles.assignedText}>
                        {request.assignedDoctor || "배정완료"}
                      </span>
                    ) : (
                      <span className={styles.rejectedText}>-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 의사 배정 모달 */}
      {assigningRequest && (
        <div className={styles.modalOverlay} onClick={handleCloseAssignModal}>
          <div className={styles.assignModalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>의사 배정 - {assigningRequest.patientName}</h3>
              <button className={styles.closeButton} onClick={handleCloseAssignModal}>
                ✕
              </button>
            </div>
            <div className={styles.assignModalBody}>
              {/* 환자 정보 요약 */}
              <div className={styles.patientSummary}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>희망 일시:</span>
                  <span className={styles.summaryValue}>
                    {assigningRequest.preferredDate} {assigningRequest.preferredTime}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>증상:</span>
                  <span className={styles.summaryValue}>{assigningRequest.symptoms}</span>
                </div>
              </div>

              {/* 날짜 선택 */}
              <div className={styles.dateSelector}>
                <label className={styles.dateLabel}>예약 날짜 선택:</label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              {/* 의사 일정 표시 */}
              {selectedDate && (
                <div className={styles.scheduleList}>
                  <h4 className={styles.scheduleTitle}>
                    {selectedDate} 진료 가능한 의사
                  </h4>
                  {getSchedulesForDate(selectedDate).length > 0 ? (
                    <div className={styles.scheduleCards}>
                      {getSchedulesForDate(selectedDate)
                        .filter(schedule => schedule.isAvailable && schedule.scheduleType === 'CLINIC')
                        .map((schedule, index) => (
                          <div key={index} className={styles.scheduleCard}>
                            <div className={styles.scheduleCardHeader}>
                              <div>
                                <h5 className={styles.doctorNameLarge}>{schedule.doctorName}</h5>
                                <p className={styles.doctorInfo}>
                                  {schedule.department} | 진료실 {schedule.room}
                                </p>
                              </div>
                              <div className={styles.scheduleStatus}>
                                <span className={styles.availableSlots}>
                                  {schedule.maxAppointments - schedule.currentAppointments}석 가능
                                </span>
                                <span className={styles.scheduleTime}>
                                  {schedule.startTime}~{schedule.endTime}
                                </span>
                              </div>
                            </div>
                            <div className={styles.timeSlotsContainer}>
                              <p className={styles.timeSlotsLabel}>예약 가능 시간:</p>
                              <div className={styles.timeSlots}>
                                {getAvailableTimeSlots(schedule).map(timeSlot => (
                                  <button
                                    key={timeSlot}
                                    className={styles.timeSlotBtn}
                                    onClick={() => handleAssignDoctor(schedule, timeSlot)}
                                  >
                                    {timeSlot}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.noSchedules}>
                      해당 날짜에 진료 가능한 의사가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 증상 상세 모달 */}
      {selectedRequest && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>증상 상세 정보</h3>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>환자명:</span>
                <span className={styles.modalValue}>{selectedRequest.patientName}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>환자번호:</span>
                <span className={styles.modalValue}>{selectedRequest.patientId}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>요청일시:</span>
                <span className={styles.modalValue}>
                  {selectedRequest.requestDate} {selectedRequest.requestTime}
                </span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>희망 예약일시:</span>
                <span className={styles.modalValue}>
                  {selectedRequest.preferredDate} {selectedRequest.preferredTime}
                </span>
              </div>
              <div className={styles.symptomSection}>
                <span className={styles.modalLabel}>증상:</span>
                <p className={styles.symptomText}>{selectedRequest.symptoms}</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCloseBtn} onClick={handleCloseModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagementPage;
