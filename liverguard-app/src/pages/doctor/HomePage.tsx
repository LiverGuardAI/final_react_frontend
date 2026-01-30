import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorData } from '../../contexts/DoctorDataContext';
import { getAnnouncements, type AnnouncementItem } from '../../api/doctorApi';
import { getUserSchedules, type UserScheduleData } from '../../api/hospitalOpsApi';
import { mapWorkflowStateToStatus } from '../../utils/encounterUtils';

export default function DoctorHomePage() {
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [weekSchedules, setWeekSchedules] = useState<UserScheduleData[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Shared Data from DoctorLayout (via Context)
  // WebSocket updates in Layout will automatically update these values here.
  const { waitingQueueData, stats, uniquePatientCounts } = useDoctorData();

  useEffect(() => {
    // 의사 정보 로드
    const storedDoctor = localStorage.getItem('doctor');
    if (storedDoctor) {
      try {
        const doctorInfo = JSON.parse(storedDoctor);
        setDoctorId(doctorInfo.doctor_id || null);
      } catch (error) {
        console.error('의사 정보 파싱 실패:', error);
      }
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userInfo = JSON.parse(storedUser);
        setUserId(userInfo.id || userInfo.user_id || null);
      } catch (error) {
        console.error('사용자 정보 파싱 실패:', error);
      }
    }
  }, []);

  // 대기 중인 환자 목록 추출 (진료 대기 + 진료 중)
  const waitingPatients = useMemo(() => {
    if (!waitingQueueData?.queue) return [];

    return waitingQueueData.queue
      .filter((item: any) =>
        item.workflow_state === 'WAITING_CLINIC' ||
        item.workflow_state === 'WAITING_ADDITIONAL_CLINIC' ||
        item.workflow_state === 'IN_CLINIC'
      )
      .map((item: any) => {
        const patientObj: any = (typeof item.patient === 'object' && item.patient !== null) ? item.patient : null;
        return {
          encounterId: item.encounter_id,
          patientId: patientObj?.patient_id || 'N/A',
          name: item.patient_name || patientObj?.name || '이름 없음',
          birthDate: patientObj?.date_of_birth || 'N/A',
          age: patientObj?.age || 0,
          gender: patientObj?.gender === 'M' ? '남' : patientObj?.gender === 'F' ? '여' : 'N/A',
          status: 'WAITING',
        };
      });
  }, [waitingQueueData]);

  // 최근 완료된 환자 (가장 최근 1명) - 수납 대기, 결과 대기, 촬영 대기/중 포함
  const recentCompletedPatient = useMemo(() => {
    if (!waitingQueueData?.queue) return null;

    const completed = waitingQueueData.queue
      .filter((item: any) =>
        ['WAITING_PAYMENT', 'WAITING_RESULTS', 'WAITING_ORDER', 'WAITING_IMAGING', 'IN_IMAGING'].includes(item.workflow_state)
      )
      .sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at);
        const dateB = new Date(b.updated_at || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

    if (completed.length === 0) return null;

    const item = completed[0];
    const patientObj: any = (typeof item.patient === 'object' && item.patient !== null) ? item.patient : null;

    return {
      encounterId: item.encounter_id,
      patientId: patientObj?.patient_id || 'N/A',
      name: item.patient_name || patientObj?.name || '이름 없음',
      birthDate: patientObj?.date_of_birth || 'N/A',
      age: patientObj?.age || 0,
      gender: patientObj?.gender === 'M' ? '남' : patientObj?.gender === 'F' ? '여' : 'N/A',
      chiefComplaint: item.chief_complaint || '미기재',
      diagnosis: item.diagnosis || '미기재',
    };
  }, [waitingQueueData]);

  // 프론트엔드 표시용: Context에서 받은 고유 환자 수 사용 (중복 계산 제거)
  const patientStatus = uniquePatientCounts || { waiting: 0, inProgress: 0, completed: 0 };

  const totalPatients = patientStatus.waiting + patientStatus.completed;
  const waitingPercentage = totalPatients > 0 ? (patientStatus.waiting / totalPatients) * 100 : 0;
  const inProgressPercentage = totalPatients > 0 ? (patientStatus.inProgress / totalPatients) * 100 : 0;
  const completedPercentage = totalPatients > 0 ? (patientStatus.completed / totalPatients) * 100 : 0;

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const announcementPageSize = 5;

  useEffect(() => {
    let isMounted = true;
    const fetchAnnouncements = async () => {
      setIsAnnouncementsLoading(true);
      setAnnouncementsError(null);
      try {
        const response = await getAnnouncements();
        if (!isMounted) return;
        setAnnouncements(response.results);
      } catch (error) {
        console.error('공지사항 조회 실패:', error);
        if (!isMounted) return;
        setAnnouncementsError('공지사항을 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsAnnouncementsLoading(false);
        }
      }
    };
    fetchAnnouncements();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalAnnouncementPages = Math.max(1, Math.ceil(announcements.length / announcementPageSize));
  const safeAnnouncementPage = Math.min(announcementPage, totalAnnouncementPages);
  const announcementStartIndex = (safeAnnouncementPage - 1) * announcementPageSize;
  const announcementEndIndex = Math.min(announcementStartIndex + announcementPageSize, announcements.length);
  const paginatedAnnouncements = announcements.slice(announcementStartIndex, announcementEndIndex);

  useEffect(() => {
    if (announcementPage !== safeAnnouncementPage) {
      setAnnouncementPage(safeAnnouncementPage);
    }
  }, [announcementPage, safeAnnouncementPage]);

  const formatAnnouncementDate = (dateValue?: string | null) => {
    if (!dateValue) return '—';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    return parsed.toLocaleDateString('ko-KR');
  };

  const getAnnouncementPreview = (content?: string | null) => {
    const trimmed = (content || '').trim();
    if (!trimmed) return '내용이 없습니다.';
    const limit = 120;
    return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
  };

  const announcementTypeTheme: Record<string, { label: string; background: string; color: string; border: string }> = {
    GENERAL: { label: '일반', background: '#E3F2FD', color: '#1976D2', border: '#C7DEF5' },
    URGENT: { label: '긴급', background: '#FFE3E3', color: '#D32F2F', border: '#F5B9B9' },
    EVENT: { label: '행사', background: '#FFF3E0', color: '#F57C00', border: '#F4D7B4' },
    MAINTENANCE: { label: '점검', background: '#E8F5E9', color: '#388E3C', border: '#CDEBD0' },
  };

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addDays = (date: Date, days: number) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

  const getWeekRange = (date: Date) => {
    const day = date.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (day + 6) % 7; // Monday = 0
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - diffToMonday);
    const sunday = addDays(monday, 6);
    return {
      startDate: formatLocalDate(monday),
      endDate: formatLocalDate(sunday)
    };
  };

  const formatTime = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 5);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return trimmed;
    return parsed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatScheduleType = (type?: string | null) => {
    switch (type) {
      case 'CONFERENCE':
        return '학회';
      case 'VACATION':
        return '휴가';
      case 'OTHER':
        return '기타';
      default:
        return type || '일정';
    }
  };

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    const loadSchedules = async () => {
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const { startDate, endDate } = getWeekRange(new Date());
        const response = await getUserSchedules(startDate, endDate);
        const rawList: UserScheduleData[] = Array.isArray(response) ? response : response.results || [];
        const filtered = rawList
          .filter((item: UserScheduleData) => item.schedule_date || item.start_time || item.end_time)
          .sort((a: UserScheduleData, b: UserScheduleData) => {
            const dateA = a.schedule_date || '';
            const dateB = b.schedule_date || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const timeA = a.start_time || '';
            const timeB = b.start_time || '';
            return timeA.localeCompare(timeB);
          });
        if (isMounted) {
          setWeekSchedules(filtered);
        }
      } catch (error) {
        console.error('근무 일정 조회 실패:', error);
        if (isMounted) {
          setScheduleError('근무 일정을 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setScheduleLoading(false);
        }
      }
    };
    loadSchedules();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto 1fr', gap: '20px', padding: '10px 24px 24px 24px', height: '100%', boxSizing: 'border-box', zoom: '0.7' }}>
      {/* 첫 번째 행 왼쪽: 오늘의 진료 현황 */}
      <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#FFF', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #EEF2F7' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>오늘의 진료 현황</h2>
          </div>
          <div style={{ padding: '24px 30px', flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', color: '#666' }}>대기 환자</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.waiting}명</span>
                </div>
                <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${waitingPercentage}%`, height: '100%', background: '#FFB800', transition: 'width 0.3s' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', color: '#666' }}>진료 중</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.inProgress}명</span>
                </div>
                <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${inProgressPercentage}%`, height: '100%', background: '#00A3FF', transition: 'width 0.3s' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', color: '#666' }}>완료 환자</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.completed}명</span>
                </div>
                <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${completedPercentage}%`, height: '100%', background: '#8BC34A', transition: 'width 0.3s' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 오른쪽 상단: 일정 관리 */}
      <div style={{ gridColumn: '2', gridRow: '1', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ background: '#FFF', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #EEF2F7' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>일정 관리</h2>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0', display: 'flex', flexDirection: 'column' }}>
            {scheduleLoading ? (
              <div style={{ color: '#7A8899', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                일주일 일정 불러오는 중...
              </div>
            ) : scheduleError ? (
              <div style={{ color: '#D32F2F', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {scheduleError}
              </div>
            ) : weekSchedules.length === 0 ? (
              <div style={{ color: '#7A8899', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                이번 주 일정이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 220px 140px 1fr',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    background: '#F8FAFC',
                    color: '#64748B',
                    fontSize: '13px',
                    fontWeight: '600',
                    borderBottom: 'none',
                    margin: '12px 16px 6px',
                    borderRadius: '10px'
                  }}
                >
                  <span>날짜</span>
                  <span>시간</span>
                  <span>유형</span>
                  <span>내용</span>
                </div>
                {weekSchedules.map((schedule, index) => {
                  const timeLabel = `${formatTime(schedule.start_time) || '-'} - ${formatTime(schedule.end_time) || '-'}`;
                  const scheduleDate = schedule.schedule_date
                    || (schedule.start_time ? schedule.start_time.split('T')[0] : '')
                    || (schedule.end_time ? schedule.end_time.split('T')[0] : '');
                  return (
                    <div
                      key={schedule.schedule_id || `${schedule.schedule_date}-${schedule.start_time}-${schedule.end_time}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 220px 140px 1fr',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
                        margin: index === 0 ? '8px 16px 6px' : '6px 16px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const targetDate = scheduleDate || formatLocalDate(new Date());
                        navigate(`/doctor/schedule?date=${encodeURIComponent(targetDate)}`);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          const targetDate = scheduleDate || formatLocalDate(new Date());
                          navigate(`/doctor/schedule?date=${encodeURIComponent(targetDate)}`);
                        }
                      }}
                    >
                      <span style={{ fontSize: '16px', fontWeight: '600', color: '#1F2A44' }}>
                        {scheduleDate || '-'}
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: '600', color: '#1F2A44' }}>
                        {timeLabel}
                      </span>
                      <span style={{ fontSize: '16px', color: '#374151' }}>
                        {formatScheduleType(schedule.schedule_type)}
                      </span>
                      <span
                        style={{
                          fontSize: '16px',
                          color: '#374151',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {schedule.notes || '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 두 번째 행: 빠른 실행 + 최근 환자 내역 */}
      <div style={{ gridColumn: '1 / 3', gridRow: '2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: 0 }}>
        {/* 빠른 실행 */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#FFF', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EEF2F7' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>빠른 실행</h2>
            </div>
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', flex: 1 }}>
              <button
                onClick={() => navigate('/doctor/ct-result')}
                style={{ background: '#E3F2FD', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}
              >
                <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                  <path d="M24 14C21.79 14 20 15.79 20 18C20 20.21 21.79 22 24 22C26.21 22 28 20.21 28 18C28 15.79 26.21 14 24 14ZM24 24C20.67 24 14 25.67 14 29V31C14 31.55 14.45 32 15 32H33C33.55 32 34 31.55 34 31V29C34 25.67 27.33 24 24 24Z" fill="#1976D2" />
                  <rect x="14" y="16" width="20" height="2" rx="1" fill="#1976D2" />
                  <rect x="14" y="20" width="16" height="2" rx="1" fill="#1976D2" />
                  <rect x="14" y="24" width="18" height="2" rx="1" fill="#1976D2" />
                </svg>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#1976D2' }}>검사 결과</span>
              </button>
              <button
                onClick={() => navigate('/doctor/ai-stage-prediction')}
                style={{ background: '#FFF3E0', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}
              >
                <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                  <rect x="14" y="16" width="20" height="2" rx="1" fill="#F57C00" />
                  <rect x="14" y="20" width="16" height="2" rx="1" fill="#F57C00" />
                  <rect x="14" y="24" width="18" height="2" rx="1" fill="#F57C00" />
                  <circle cx="31" cy="31" r="7" fill="#F57C00" />
                  <path d="M31 27V35M27 31H35" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#F57C00' }}>AI 분석</span>
              </button>
              <button
                onClick={() => navigate('/doctor/medical-record')}
                style={{ background: '#E8F5E9', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}
              >
                <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                  <rect x="16" y="14" width="16" height="20" rx="2" fill="white" stroke="#388E3C" strokeWidth="2" />
                  <path d="M20 20H28M20 24H28M20 28H25" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="32" cy="32" r="6" fill="#388E3C" />
                  <path d="M29.5 32L31 33.5L34.5 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#388E3C' }}>진료 기록</span>
              </button>
              <button
                onClick={() => navigate('/doctor/schedule')}
                style={{ background: '#F3E5F5', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}
              >
                <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                  <rect x="14" y="18" width="20" height="16" rx="2" fill="white" stroke="#7B1FA2" strokeWidth="2" />
                  <circle cx="24" cy="22" r="2" fill="#7B1FA2" />
                  <path d="M19 26C19 28.21 21.24 30 24 30C26.76 30 29 28.21 29 26" stroke="#7B1FA2" strokeWidth="2" strokeLinecap="round" />
                  <rect x="15" y="19" width="18" height="14" rx="1" stroke="#7B1FA2" strokeWidth="1.5" strokeDasharray="2 2" />
                </svg>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#7B1FA2' }}>일정 관리</span>
              </button>
            </div>
          </div>
        </div>

        {/* 최근 환자 내역 */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ background: '#FFF', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EEF2F7' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>최근 환자 내역</h2>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              {recentCompletedPatient ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#1F2A44' }}>
                        {recentCompletedPatient.name}
                        <span style={{ fontSize: '16px', color: '#64748B', fontWeight: '600', marginLeft: '8px' }}>
                          {recentCompletedPatient.gender}, {recentCompletedPatient.age}세
                        </span>
                      </div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#52759C', background: '#EEF6FF', padding: '6px 12px', borderRadius: '999px' }}>
                          환자 ID · {recentCompletedPatient.patientId}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#52759C', background: '#EEF6FF', padding: '6px 12px', borderRadius: '999px' }}>
                          생년월일 · {recentCompletedPatient.birthDate}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#3B5C80', background: '#E6F0FF', padding: '7px 14px', borderRadius: '999px' }}>
                      최근 진료 완료
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '18px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#7A8899' }}>주증상</span>
                      <span style={{ fontSize: '19px', fontWeight: '600', color: '#1F2A44' }}>
                        {recentCompletedPatient.chiefComplaint}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#7A8899' }}>진단</span>
                      <span style={{ fontSize: '19px', fontWeight: '600', color: '#1F2A44' }}>
                        {recentCompletedPatient.diagnosis}
                      </span>
                    </div>
                  </div>
                  <button
                    style={{ width: '100%', background: '#D7E8FB', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '18px', fontWeight: '600', color: '#52759C', cursor: 'pointer', marginTop: '8px' }}
                    onClick={() => {
                      const searchValue = recentCompletedPatient.name;
                      navigate(`/doctor/medical-record?search=${encodeURIComponent(searchValue)}`);
                    }}
                  >
                    진료 기록 보기
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '16px', color: '#999', textAlign: 'center', padding: '40px 0' }}>
                  최근 진료 내역이 없습니다
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 세 번째 행: 공지사항 */}
      <div style={{ gridColumn: '1 / 3', gridRow: '3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ background: '#FFF', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #EEF2F7', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>공지사항</h2>
            <span style={{ fontSize: '14px', color: '#7A8899' }}>
              {announcements.length}건
            </span>
          </div>
          <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {isAnnouncementsLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A8899' }}>
                공지사항을 불러오는 중...
              </div>
            ) : announcementsError ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D32F2F' }}>
                {announcementsError}
              </div>
            ) : announcements.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A8899' }}>
                등록된 공지사항이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {paginatedAnnouncements.map((announcement, index) => {
                  const theme = announcementTypeTheme[announcement.announcement_type] || announcementTypeTheme.GENERAL;
                  const badgeLabel = announcement.announcement_type_display || theme.label;
                  const dateLabel = formatAnnouncementDate(announcement.published_at || announcement.created_at);
                  return (
                    <div
                      key={announcement.announcement_id}
                      style={{
                        padding: '14px 0',
                        borderBottom: index === paginatedAnnouncements.length - 1 ? 'none' : '1px solid #E6ECF3',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px'
                      }}
                      onClick={() => setSelectedAnnouncement(announcement)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '14px',
                            fontWeight: '600',
                            background: theme.background,
                            color: theme.color,
                            border: `1px solid ${theme.border}`,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {badgeLabel}
                        </span>
                        {announcement.is_important && (
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '14px',
                              fontWeight: '600',
                              background: '#FFEBEE',
                              color: '#D32F2F',
                              border: '1px solid #F5B9B9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            중요
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '17px',
                            fontWeight: '700',
                            color: '#1F2A44',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            maxWidth: '280px'
                          }}
                        >
                          {announcement.title}
                        </div>
                        <div
                          style={{
                            fontSize: '15px',
                            color: '#5F6B7A',
                            lineHeight: '1.4',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            flex: 1
                          }}
                        >
                          {getAnnouncementPreview(announcement.content)}
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', color: '#8A94A6', whiteSpace: 'nowrap' }}>{dateLabel}</span>
                    </div>
                  );
                })}
                {announcements.length > announcementPageSize && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                    <button
                      style={{
                        border: '1px solid #D7E8FB',
                        background: '#FFFFFF',
                        color: '#52759C',
                        borderRadius: '10px',
                        padding: '10px 16px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: safeAnnouncementPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: safeAnnouncementPage === 1 ? 0.4 : 1
                      }}
                      onClick={() => setAnnouncementPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeAnnouncementPage === 1}
                    >
                      이전
                    </button>
                    {Array.from({ length: totalAnnouncementPages }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        style={{
                          border: '1px solid #D7E8FB',
                          background: safeAnnouncementPage === pageNumber ? '#52759C' : '#FFFFFF',
                          color: safeAnnouncementPage === pageNumber ? '#FFFFFF' : '#52759C',
                          borderRadius: '10px',
                          padding: '10px 16px',
                          fontSize: '15px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          minWidth: '42px'
                        }}
                        onClick={() => setAnnouncementPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      style={{
                        border: '1px solid #D7E8FB',
                        background: '#FFFFFF',
                        color: '#52759C',
                        borderRadius: '10px',
                        padding: '10px 16px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: safeAnnouncementPage === totalAnnouncementPages ? 'not-allowed' : 'pointer',
                        opacity: safeAnnouncementPage === totalAnnouncementPages ? 0.4 : 1
                      }}
                      onClick={() => setAnnouncementPage((prev) => Math.min(totalAnnouncementPages, prev + 1))}
                      disabled={safeAnnouncementPage === totalAnnouncementPages}
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      </div>

      {selectedAnnouncement && (
        <div
          onClick={() => setSelectedAnnouncement(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '24px'
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(720px, 96vw)',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: (announcementTypeTheme[selectedAnnouncement.announcement_type] || announcementTypeTheme.GENERAL).background,
                      color: (announcementTypeTheme[selectedAnnouncement.announcement_type] || announcementTypeTheme.GENERAL).color,
                      border: `1px solid ${(announcementTypeTheme[selectedAnnouncement.announcement_type] || announcementTypeTheme.GENERAL).border}`
                    }}
                  >
                    {selectedAnnouncement.announcement_type_display || (announcementTypeTheme[selectedAnnouncement.announcement_type] || announcementTypeTheme.GENERAL).label}
                  </span>
                  {selectedAnnouncement.is_important && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: '#FFEBEE',
                        color: '#D32F2F',
                        border: '1px solid #F5B9B9'
                      }}
                    >
                      중요
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#1F2A44' }}>
                  {selectedAnnouncement.title}
                </div>
                <div style={{ fontSize: '12px', color: '#8A94A6' }}>
                  {formatAnnouncementDate(selectedAnnouncement.published_at || selectedAnnouncement.created_at)}
                  {selectedAnnouncement.author_name ? ` · ${selectedAnnouncement.author_name}` : ''}
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                style={{
                  border: 'none',
                  background: '#F2F4F8',
                  color: '#5F6B7A',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
            <div
              style={{
                borderTop: '1px solid #E6ECF3',
                paddingTop: '12px',
                fontSize: '13px',
                color: '#4B5563',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                maxHeight: '60vh',
                overflow: 'auto'
              }}
            >
              {selectedAnnouncement.content}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
