import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from "../../pages/administration/Dashboard.module.css"; // 스타일 재사용

export default function AdministrationTopBar() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('administration');

        logout();
        navigate('/');
    };

    return (
        <div className={styles.topBar}>
            <div className={styles.tabsContainer}>
                <NavLink
                    to="/administration/home"
                    className={({ isActive }) => `${styles.tabButton} ${isActive ? styles.active : ''}`}
                >
                    <span>홈</span>
                </NavLink>

                <NavLink
                    to="/administration/appointments"
                    className={({ isActive }) => `${styles.tabButton} ${isActive ? styles.active : ''}`}
                >
                    <span>예약 관리</span>
                </NavLink>

                <NavLink
                    to="/administration/patientstatus"
                    className={({ isActive }) => `${styles.tabButton} ${isActive ? styles.active : ''}`}
                >
                    <span>환자 현황</span>
                </NavLink>

                <NavLink
                    to="/administration/patients"
                    className={({ isActive }) => `${styles.tabButton} ${isActive ? styles.active : ''}`}
                >
                    <span>환자 관리</span>
                </NavLink>
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
                <button
                    className={styles.iconButton}
                    onClick={() => console.log('Notifications clicked')}
                    title="알림"
                >
                    <svg className={styles.bellIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="currentColor" />
                    </svg>
                </button>
                <button
                    className={styles.iconButton}
                    onClick={handleLogout}
                    title="로그아웃"
                >
                    <svg className={styles.logoutIcon} width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
