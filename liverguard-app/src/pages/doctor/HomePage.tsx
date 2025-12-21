import { useState } from 'react';
import styles from './DoctorHome.module.css';

interface Patient {
  id: number;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  lastVisit?: string;
}

type TabType = 'home' | 'schedule' | 'treatment' | 'patientManagement' | 'examination' | 'testForm' | 'medication';

export default function DoctorHomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'waiting' | 'completed'>('waiting');

  // 샘플 환자 데이터
  const [waitingPatients] = useState<Patient[]>([
    { id: 1, name: '장보윤', birthDate: '2000.05.21', age: 26, gender: '여' },
    { id: 2, name: '송영은', birthDate: '2000.05.21', age: 26, gender: '남' },
    { id: 3, name: '정예진', birthDate: '2000.05.21', age: 26, gender: '여' },
  ]);

  const [completedPatients] = useState<Patient[]>([]);

  const patientStatus = {
    waiting: waitingPatients.length,
    inProgress: 0,
    completed: completedPatients.length,
  };

  const handleMouseEnter = () => {
    setOpenDropdown('examination');
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  const handleDropdownItemClick = (item: string) => {
    console.log(`Dropdown item clicked: ${item}`);
    setOpenDropdown(null);
    // 드롭다운 아이템 클릭 로직
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        const totalPatients = patientStatus.waiting + patientStatus.inProgress + patientStatus.completed;
        const waitingPercentage = totalPatients > 0 ? (patientStatus.waiting / totalPatients) * 100 : 0;
        const inProgressPercentage = totalPatients > 0 ? (patientStatus.inProgress / totalPatients) * 100 : 0;
        const completedPercentage = totalPatients > 0 ? (patientStatus.completed / totalPatients) * 100 : 0;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto 1fr', gap: '20px', padding: '20px', height: '100%', boxSizing: 'border-box' }}>
            {/* 첫 번째 행 왼쪽: 오늘의 진료 현황 */}
            <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                오늘의 진료 현황
                <span style={{ fontSize: '16px', cursor: 'pointer' }}>›</span>
              </h2>
              <div style={{ background: '#FFF', borderRadius: '15px', padding: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, overflow: 'auto' }}>
                {/* 간단한 막대 그래프 */}
                <div style={{ marginBottom: '40px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>대기 환자</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{patientStatus.waiting}명</span>
                    </div>
                    <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${waitingPercentage}%`, height: '100%', background: '#FFB800', transition: 'width 0.3s' }}></div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>진료 중</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{patientStatus.inProgress}명</span>
                    </div>
                    <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${inProgressPercentage}%`, height: '100%', background: '#00A3FF', transition: 'width 0.3s' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>완료 환자</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>{patientStatus.completed}명</span>
                    </div>
                    <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${completedPercentage}%`, height: '100%', background: '#8BC34A', transition: 'width 0.3s' }}></div>
                    </div>
                  </div>
                </div>
                {/* 대기 환자 정보 */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>대기 환자:</h3>
                  {waitingPatients.slice(0, 2).map((patient) => (
                    <div key={patient.id} style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                      • {patient.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 오른쪽 상단: 일정 관리 */}
            <div style={{ gridColumn: '2', gridRow: '1', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                일정 관리
                <span style={{ fontSize: '16px', fontWeight: '400' }}>2025.12.11</span>
                <span style={{ fontSize: '16px', cursor: 'pointer' }}>›</span>
              </h2>
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
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                빠른 실행
                <span style={{ fontSize: '16px', cursor: 'pointer' }}>›</span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button style={{ background: '#D7E8FB', border: 'none', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#E8F4FD"/>
                    <path d="M24 14C21.79 14 20 15.79 20 18C20 20.21 21.79 22 24 22C26.21 22 28 20.21 28 18C28 15.79 26.21 14 24 14ZM24 24C20.67 24 14 25.67 14 29V31C14 31.55 14.45 32 15 32H33C33.55 32 34 31.55 34 31V29C34 25.67 27.33 24 24 24Z" fill="#4A90E2"/>
                    <rect x="14" y="16" width="20" height="2" rx="1" fill="#4A90E2"/>
                    <rect x="14" y="20" width="16" height="2" rx="1" fill="#4A90E2"/>
                    <rect x="14" y="24" width="18" height="2" rx="1" fill="#4A90E2"/>
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#52759C' }}>환자 접수</span>
                </button>
                <button style={{ background: '#D7E8FB', border: 'none', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#FFF4E6"/>
                    <rect x="14" y="16" width="20" height="2" rx="1" fill="#F59E0B"/>
                    <rect x="14" y="20" width="16" height="2" rx="1" fill="#F59E0B"/>
                    <rect x="14" y="24" width="18" height="2" rx="1" fill="#F59E0B"/>
                    <circle cx="31" cy="31" r="7" fill="#F59E0B"/>
                    <path d="M31 27V35M27 31H35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#52759C' }}>일정 추가</span>
                </button>
                <button style={{ background: '#D7E8FB', border: 'none', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#F0FDF4"/>
                    <rect x="16" y="14" width="16" height="20" rx="2" fill="white" stroke="#10B981" strokeWidth="2"/>
                    <path d="M20 20H28M20 24H28M20 28H25" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="32" cy="32" r="6" fill="#10B981"/>
                    <path d="M29.5 32L31 33.5L34.5 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#52759C' }}>검사 결과</span>
                </button>
                <button style={{ background: '#D7E8FB', border: 'none', borderRadius: '12px', padding: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#F5F3FF"/>
                    <rect x="14" y="18" width="20" height="16" rx="2" fill="white" stroke="#8B5CF6" strokeWidth="2"/>
                    <circle cx="24" cy="22" r="2" fill="#8B5CF6"/>
                    <path d="M19 26C19 28.21 21.24 30 24 30C26.76 30 29 28.21 29 26" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="15" y="19" width="18" height="14" rx="1" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="2 2"/>
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#52759C' }}>CT 촬영</span>
                </button>
              </div>
              </div>

              {/* 최근 환자 내역 */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  최근 환자 내역
                  <span style={{ fontSize: '16px', cursor: 'pointer' }}>›</span>
                </h2>
                <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0 }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '10px' }}>정예진 (여, 29세)</div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>• 주증상: 간암</div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>• 특이사항: 알레르기</div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>• CT 촬영 여부: O</div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>• 유전체 검사/혈액 검사 여부: O</div>
                    <button style={{ width: '100%', background: '#D7E8FB', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '600', color: '#52759C', cursor: 'pointer' }}>
                      진료 기록 보기
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 세 번째 행: 최근 알림 */}
            <div style={{ gridColumn: '1 / 3', gridRow: '3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                최근 알림
                <span style={{ fontSize: '16px', cursor: 'pointer' }}>›</span>
              </h2>
              <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0 }}>
                <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #E0E0E0' }}>
                  <div style={{ fontSize: '14px', color: '#000', marginBottom: '5px' }}>• 새로운 메시지: 장재운 님 (2개)</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#000' }}>• 병원 공지: 12/25일 크리스마스 휴강</div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'schedule':
        return <div style={{ padding: '20px' }}>일정 관리 화면</div>;
      case 'treatment':
        return <div style={{ padding: '20px' }}>환자 진료 화면</div>;
      case 'patientManagement':
        return <div style={{ padding: '20px' }}>환자 관리 화면</div>;
      case 'examination':
        return <div style={{ padding: '20px' }}>검사 확인 화면</div>;
      case 'testForm':
        return <div style={{ padding: '20px' }}>검사표 화면</div>;
      case 'medication':
        return <div style={{ padding: '20px' }}>약물 화면</div>;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* 왼쪽 사이드바 */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          {/* 프로필 섹션 */}
          <div className={styles.profileSection}>
            <div className={styles.profileImage}></div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>정예진</div>
              <div className={styles.departmentTag}>소화기내과</div>
              <div className={styles.statusInfo}>
                상태: <span className={styles.statusBadge}>근무중</span>
              </div>
            </div>
          </div>

          {/* 환자 리스트 섹션 */}
          <div className={styles.patientListSection}>
            <div className={styles.patientListTabs}>
              <button
                className={`${styles.patientListTab} ${sidebarTab === 'waiting' ? styles.active : ''}`}
                onClick={() => setSidebarTab('waiting')}
              >
                진료대기 ({patientStatus.waiting}명)
              </button>
              <button
                className={`${styles.patientListTab} ${sidebarTab === 'completed' ? styles.active : ''}`}
                onClick={() => setSidebarTab('completed')}
              >
                진료완료 ({patientStatus.completed}명)
              </button>
            </div>

            <div className={styles.patientListContent}>
              {sidebarTab === 'waiting' && waitingPatients.length > 0 ? (
                waitingPatients.map((patient) => (
                  <div key={patient.id} className={styles.patientCard}>
                    <div className={styles.patientHeader}>
                      <span className={styles.patientName}>{patient.name}</span>
                      <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                    </div>
                    <div className={styles.patientDetails}>
                      {patient.birthDate} | {patient.age} | {patient.gender}
                    </div>
                    <div className={styles.patientActions}>
                      <button className={`${styles.actionButton} ${styles.start}`}>
                        진료시작
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                      15:12
                    </div>
                  </div>
                ))
              ) : sidebarTab === 'completed' && completedPatients.length > 0 ? (
                completedPatients.map((patient) => (
                  <div key={patient.id} className={styles.patientCard}>
                    <div className={styles.patientHeader}>
                      <span className={styles.patientName}>{patient.name}</span>
                      <span className={styles.genderIcon}>{patient.gender === '여' ? '♀' : '♂'}</span>
                    </div>
                    <div className={styles.patientDetails}>
                      {patient.birthDate} | {patient.age} | {patient.gender}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  {sidebarTab === 'waiting' ? '대기 중인 환자가 없습니다' : '완료된 진료가 없습니다'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className={styles.mainArea}>
        {/* 상단 탭 바 */}
        <div className={styles.topBar}>
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${activeTab === 'home' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('home');
                setOpenDropdown(null);
              }}
            >
              <span>홈</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('schedule');
                setOpenDropdown(null);
              }}
            >
              <span>일정 관리</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'treatment' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('treatment');
                setOpenDropdown(null);
              }}
            >
              <span>환자 진료</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'patientManagement' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('patientManagement');
                setOpenDropdown(null);
              }}
            >
              <span>환자 관리</span>
            </button>

            <div
              style={{ position: 'relative', flex: 1, maxWidth: '150px' }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`${styles.tabButton} ${styles.hasDropdown} ${openDropdown === 'examination' ? styles.active : ''}`}
              >
                <span>검사 확인</span>
              </button>
              {openDropdown === 'examination' && (
                <div className={styles.dropdownMenu}>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('CT 촬영')}
                  >
                    CT 촬영
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('유전체 검사 확인')}
                  >
                    유전체 검사 확인
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleDropdownItemClick('혈액 검사 확인')}
                  >
                    혈액 검사 확인
                  </button>
                </div>
              )}
            </div>

            <button
              className={`${styles.tabButton} ${activeTab === 'testForm' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('testForm');
                setOpenDropdown(null);
              }}
            >
              <span>검사표</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'medication' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('medication');
                setOpenDropdown(null);
              }}
            >
              <span>약물</span>
            </button>
          </div>

          {/* 우측 아이콘 */}
          <div className={styles.topBarIcons}>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Messages clicked')}
              title="메시지"
            >
              <svg className={styles.messageIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Notifications clicked')}
              title="알림"
            >
              <svg className={styles.bellIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={styles.iconButton}
              onClick={() => console.log('Logout clicked')}
              title="로그아웃"
            >
              <svg className={styles.logoutIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className={styles.mainContent}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
