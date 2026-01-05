import React from 'react';
import styles from '../../pages/administration/HomePage.module.css';

interface SidebarProps {
  staffName: string;
  departmentName: string;
  activeTab: string;
  onTabClick: (tab: 'home' | 'schedule' | 'appointments' | 'patients' | 'questionnaire') => void;
  onLogout: () => void;
  waitingQueueData: any;
  dashboardStats: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  staffName,
  departmentName,
  activeTab,
  onTabClick,
  onLogout,
  waitingQueueData,
  dashboardStats,
}) => {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        {/* 프로필 섹션 */}
        <div className={styles.profileSection}>
          <div className={styles.profileImage}></div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{staffName}</div>
            <div className={styles.departmentTag}>{departmentName}</div>
            <div className={styles.statusInfo}>
              상태: <span className={styles.statusBadge}>근무중</span>
            </div>
          </div>
        </div>

        {/* 총 대기 현황 섹션 */}
        <div className={styles.waitingSection}>
          <div className={styles.waitingSectionTitle}>총 대기 현황</div>
          <div className={styles.waitingList}>
            {!waitingQueueData || !waitingQueueData.queue || waitingQueueData.queue.length === 0 ? (
              <div className={styles.emptyMessage}>대기 중인 환자가 없습니다</div>
            ) : (
              waitingQueueData.queue.map((queueItem: any, index: number) => (
                <div key={index} className={styles.waitingItem}>
                  <div className={styles.patientInfo}>
                    <span className={styles.patientName}>{queueItem.patient_name}</span>
                    <span className={styles.patientId}>({queueItem.patient_id})</span>
                  </div>
                  <div className={styles.doctorInfo}>
                    담당: {queueItem.doctor_name || '미배정'}
                    {queueItem.room_number && ` (${queueItem.room_number}호)`}
                  </div>
                  <div className={styles.queueTime}>
                    접수시간: {queueItem.queued_at ? new Date(queueItem.queued_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) : 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오늘의 통계 */}
        <div className={styles.statsSection}>
          <div className={styles.statsSectionTitle}>오늘의 통계</div>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>총 환자</div>
              <div className={styles.statValue}>{dashboardStats.total_patients}명</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>진료 대기</div>
              <div className={styles.statValue}>{dashboardStats.clinic_waiting}명</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>진료 중</div>
              <div className={styles.statValue}>{dashboardStats.clinic_in_progress}명</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>완료</div>
              <div className={styles.statValue}>{dashboardStats.completed_today}명</div>
            </div>
          </div>
        </div>

        {/* 네비게이션 탭 */}
        <nav className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${activeTab === 'home' ? styles.activeTab : ''}`}
            onClick={() => onTabClick('home')}
          >
            홈
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'schedule' ? styles.activeTab : ''}`}
            onClick={() => onTabClick('schedule')}
          >
            일정
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'appointments' ? styles.activeTab : ''}`}
            onClick={() => onTabClick('appointments')}
          >
            예약 관리
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'patients' ? styles.activeTab : ''}`}
            onClick={() => onTabClick('patients')}
          >
            환자 관리
          </button>
          <button
            className={`${styles.navTab} ${activeTab === 'questionnaire' ? styles.activeTab : ''}`}
            onClick={() => onTabClick('questionnaire')}
          >
            문진표
          </button>
        </nav>

        {/* 로그아웃 */}
        <button className={styles.logoutButton} onClick={onLogout}>
          로그아웃
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
