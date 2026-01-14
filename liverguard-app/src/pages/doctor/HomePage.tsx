import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorData } from '../../contexts/DoctorDataContext';
import { getAnnouncements, type AnnouncementItem } from '../../api/doctorApi';
import { mapWorkflowStateToStatus } from '../../utils/encounterUtils';

export default function DoctorHomePage() {
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState<number | null>(null);

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
  }, []);

  // 대기 중인 환자 목록 추출 (진료 대기 + 진료 중)
  const waitingPatients = useMemo(() => {
    if (!waitingQueueData?.queue) return [];

    return waitingQueueData.queue
      .filter((item: any) =>
        item.workflow_state === 'WAITING_CLINIC' ||
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
        ['WAITING_PAYMENT', 'WAITING_RESULTS', 'WAITING_IMAGING', 'IN_IMAGING'].includes(item.workflow_state)
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

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto 1fr', gap: '20px', padding: '20px', height: '100%', boxSizing: 'border-box', zoom: '0.7' }}>
      {/* 첫 번째 행 왼쪽: 오늘의 진료 현황 */}
      <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>오늘의 진료 현황</h2>
          <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
        </div>
        <div style={{ background: '#FFF', borderRadius: '15px', padding: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, overflow: 'auto' }}>
          {/* 간단한 막대 그래프 */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px', color: '#666' }}>대기 환자</span>
                <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.waiting}명</span>
              </div>
              <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ width: `${waitingPercentage}%`, height: '100%', background: '#FFB800', transition: 'width 0.3s' }}></div>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
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
          {/* 대기 환자 정보 */}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>대기 환자:</h3>
            {waitingPatients.length === 0 ? (
              <div style={{ fontSize: '16px', color: '#999', textAlign: 'center', padding: '20px 0' }}>
                대기 중인 환자가 없습니다
              </div>
            ) : (
              waitingPatients.slice(0, 2).map((patient: any) => (
                <div key={patient.encounterId} style={{ marginBottom: '10px', fontSize: '16px', color: '#666' }}>
                  • {patient.name}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽 상단: 일정 관리 */}
      <div style={{ gridColumn: '2', gridRow: '1', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>일정 관리</h2>
          <span style={{ fontSize: '16px', fontWeight: '400', color: '#666' }}>2025.12.11</span>
          <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
        </div>
        <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* 간단한 캘린더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} style={{ fontSize: '12px', fontWeight: '600', color: '#999', padding: '8px 0' }}>{day}</div>
            ))}
            {/* 11월 달력 (30일부터 시작) */}
            {[30, 31].map((day) => (
              <div key={`prev-${day}`} style={{ fontSize: '13px', color: '#CCC', padding: '8px', borderRadius: '8px' }}>{day}</div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const isToday = day === 25;
              return (
                <div
                  key={day}
                  style={{
                    fontSize: '13px',
                    padding: '8px',
                    borderRadius: '8px',
                    background: isToday ? '#6B58B1' : 'transparent',
                    color: isToday ? '#FFF' : '#000',
                    fontWeight: isToday ? '600' : '400',
                    cursor: 'pointer'
                  }}
                >
                  {day}
                </div>
              );
            })}
            {[1, 2, 3, 4, 5].map((day) => (
              <div key={`next-${day}`} style={{ fontSize: '13px', color: '#CCC', padding: '8px', borderRadius: '8px' }}>{day}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 두 번째 행: 빠른 실행 + 최근 환자 내역 */}
      <div style={{ gridColumn: '1 / 3', gridRow: '2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: 0 }}>
        {/* 빠른 실행 */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
              빠른 실행
            </h2>
            <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
          </div>
          <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>최근 환자 내역</h2>
            <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
          </div>
          <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {recentCompletedPatient ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '10px' }}>
                    {recentCompletedPatient.name} ({recentCompletedPatient.gender}, {recentCompletedPatient.age}세)
                  </div>
                  <div style={{ fontSize: '18px', color: '#666', marginBottom: '6px' }}>
                    • 주증상: {recentCompletedPatient.chiefComplaint}
                  </div>
                  <div style={{ fontSize: '18px', color: '#666', marginBottom: '8px' }}>
                    • 진단: {recentCompletedPatient.diagnosis}
                  </div>
                  <div style={{ fontSize: '18px', color: '#666', marginBottom: '6px' }}>
                    • 환자 ID: {recentCompletedPatient.patientId}
                  </div>
                  <div style={{ fontSize: '18px', color: '#666' }}>
                    • 생년월일: {recentCompletedPatient.birthDate}
                  </div>
                </div>
                <button
                  style={{ width: '100%', background: '#D7E8FB', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '16px', fontWeight: '600', color: '#52759C', cursor: 'pointer', marginTop: '14px' }}
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

      {/* 세 번째 행: 공지사항 */}
      <div style={{ gridColumn: '1 / 3', gridRow: '3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>공지사항</h2>
            <span style={{ fontSize: '14px', color: '#7A8899' }}>
              {announcements.length}건
            </span>
          </div>
          <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
        </div>
        <div style={{ background: '#FFF', borderRadius: '15px', padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: 'auto', paddingTop: '10px' }}>
                  <button
                    style={{
                      border: '1px solid #D7E8FB',
                      background: '#FFFFFF',
                      color: '#52759C',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '13px',
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
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minWidth: '36px'
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
                      padding: '8px 12px',
                      fontSize: '13px',
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
