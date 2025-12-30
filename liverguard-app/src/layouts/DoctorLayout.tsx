import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DoctorLayout.module.css';

interface Patient {
  id: number;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  lastVisit?: string;
}

type TabType = 'home' | 'schedule' | 'treatment' | 'patientManagement' | 'examination' | 'testForm' | 'medication';

interface DoctorLayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
}

export default function DoctorLayout({ children, activeTab }: DoctorLayoutProps) {
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'waiting' | 'completed'>('waiting');

  // 샘플 환자 데이터
  const [waitingPatients] = useState<Patient[]>([
    { id: 1, name: '장보윤', birthDate: '2000.05.21', age: 26, gender: '여' },
    { id: 2, name: '송영운', birthDate: '2000.05.21', age: 26, gender: '남' },
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

    // 드롭다운 아이템에 따라 페이지 이동
    if (item === 'CT 촬영') {
      navigate('/doctor/ct-result');
    }
  };

  const handleTabClick = (tab: TabType) => {
    setOpenDropdown(null);
    switch (tab) {
      case 'home':
        navigate('/doctor/home');
        break;
      case 'schedule':
        navigate('/doctor/schedule');
        break;
      case 'treatment':
        navigate('/doctor/treatment');
        break;
      default:
        break;
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
              onClick={() => handleTabClick('home')}
            >
              <span>홈</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.active : ''}`}
              onClick={() => handleTabClick('schedule')}
            >
              <span>일정 관리</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'treatment' ? styles.active : ''}`}
              onClick={() => handleTabClick('treatment')}
            >
              <span>환자 진료</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'patientManagement' ? styles.active : ''}`}
              onClick={() => handleTabClick('patientManagement')}
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
              onClick={() => handleTabClick('testForm')}
            >
              <span>검사표</span>
            </button>

            <button
              className={`${styles.tabButton} ${activeTab === 'medication' ? styles.active : ''}`}
              onClick={() => handleTabClick('medication')}
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
          {children}
        </div>
      </div>
    </div>
  );
}
