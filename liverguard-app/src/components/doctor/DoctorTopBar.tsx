import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../layouts/DoctorLayout.module.css';
import { useNotification } from '../../context/NotificationContext';

type TabType = 'home' | 'schedule' | 'treatment' | 'medicalRecord' | 'examination' | 'testForm' | 'medication';

interface DoctorTopBarProps {
  activeTab: TabType;
}

const DoctorTopBar = memo(function DoctorTopBar({ activeTab }: DoctorTopBarProps) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleMouseEnter = (dropdown: string) => {
    setOpenDropdown(dropdown);
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  const handleDropdownItemClick = (item: string) => {
    console.log(`Dropdown item clicked: ${item}`);
    setOpenDropdown(null);

    // 드롭다운 아이템에 따라 페이지 이동
    if (item === 'CT 촬영 결과') {
      navigate('/doctor/ct-result');
    } else if (item === '유전체 검사 결과') {
      navigate('/doctor/mrna-result');
    } else if (item === '혈액 검사 결과') {
      navigate('/doctor/blood-result');
    } else if (item === '병기예측') {
      navigate('/doctor/ai-stage-prediction');
    } else if (item === '조기재발예측') {
      navigate('/doctor/ai-recurrence-prediction');
    } else if (item === '생존분석') {
      navigate('/doctor/ai-survival-analysis');
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
      case 'testForm':
        navigate('/doctor/ai-result');
        break;
      case 'medicalRecord':
        navigate('/doctor/medical-record');
        break;
      case 'medication':
        navigate('/doctor/ddi');
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'home' ? styles.active : ''}`}
          onClick={() => handleTabClick('home')}
        >
          <span>홈</span>
        </button>

        <button
          className={`${styles.tabButton} ${activeTab === 'treatment' ? styles.active : ''}`}
          onClick={() => handleTabClick('treatment')}
        >
          <span>환자 진료</span>
        </button>

        <div
          style={{ position: 'relative', flex: 1, maxWidth: '150px' }}
          onMouseEnter={() => handleMouseEnter('examination')}
          onMouseLeave={handleMouseLeave}
        >
          <button
            className={`${styles.tabButton} ${styles.hasDropdown} ${openDropdown === 'examination' ? styles.active : ''}`}
          >
            <span>검사 결과</span>
          </button>
          {openDropdown === 'examination' && (
            <div className={styles.dropdownMenu}>
              <button
                className={styles.dropdownItem}
                onClick={() => handleDropdownItemClick('CT 촬영 결과')}
              >
                CT 촬영 결과
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => handleDropdownItemClick('유전체 검사 결과')}
              >
                유전체 검사 결과
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => handleDropdownItemClick('혈액 검사 결과')}
              >
                혈액 검사 결과
              </button>
            </div>
          )}
        </div>

        <div
          style={{ position: 'relative', flex: 1, maxWidth: '150px' }}
          onMouseEnter={() => handleMouseEnter('aiAnalysis')}
          onMouseLeave={handleMouseLeave}
        >
          <button
            className={`${styles.tabButton} ${styles.hasDropdown} ${openDropdown === 'aiAnalysis' ? styles.active : ''}`}
          >
            <span>AI분석</span>
          </button>
          {openDropdown === 'aiAnalysis' && (
            <div className={styles.dropdownMenu}>
              <button
                className={styles.dropdownItem}
                onClick={() => handleDropdownItemClick('병기예측')}
              >
                병기예측
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => handleDropdownItemClick('조기재발예측')}
              >
                조기재발예측
              </button>
              <button
                className={styles.dropdownItem}
                onClick={() => handleDropdownItemClick('생존분석')}
              >
                생존분석
              </button>
            </div>
          )}
        </div>

        <button
          className={`${styles.tabButton} ${activeTab === 'medicalRecord' ? styles.active : ''}`}
          onClick={() => handleTabClick('medicalRecord')}
        >
          <span>진료 기록</span>
        </button>

        <button
          className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.active : ''}`}
          onClick={() => handleTabClick('schedule')}
        >
          <span>일정 관리</span>
        </button>

        <button
          className={`${styles.tabButton} ${activeTab === 'medication' ? styles.active : ''}`}
          onClick={() => handleTabClick('medication')}
        >
          <span>약물 상호작용</span>
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
            <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z" fill="currentColor" />
          </svg>
        </button>
        <div className={styles.notificationContainer}>
          <button
            className={styles.iconButton}
            onClick={() => setShowNotifications(!showNotifications)}
            title="알림"
          >
            <svg className={styles.bellIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor" />
            </svg>
            {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className={styles.notificationDropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownHeaderTitle}>알림</span>
                <button className={styles.markAllReadBtn} onClick={markAllAsRead}>모두 읽음</button>
              </div>
              <div className={styles.dropdownList}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                    알림이 없습니다.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.notification_id}
                      className={`${styles.notificationItem} ${n.is_read ? styles.read : styles.unread}`}
                      onClick={() => markAsRead(n.notification_id)}
                    >
                      <div className={styles.notiMessage}>{n.message}</div>
                      <div className={styles.notiTime}>
                        {new Date(n.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <button
          className={styles.iconButton}
          onClick={() => {
            // 로그아웃 처리
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            localStorage.removeItem('doctor');
            localStorage.removeItem('userRole'); // context store
            navigate('/');
          }}
          title="로그아웃"
        >
          <svg className={styles.logoutIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default DoctorTopBar;
