import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./LisSidebar.module.css";

const LisSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isActive = (target: string) => path === target;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>LIS</div>
        <div className={styles.subtitle}>Laboratory Information</div>
      </div>
      <nav className={styles.nav} aria-label="LIS navigation">
        <button
          type="button"
          className={`${styles.navItem} ${isActive("/lis/home") ? styles.navItemActive : ""}`}
          onClick={() => navigate("/lis/home")}
        >
          홈
        </button>
        <button
          type="button"
          className={`${styles.navItem} ${isActive("/lis/reception") ? styles.navItemActive : ""}`}
          onClick={() => navigate("/lis/reception")}
        >
          검사 접수
        </button>
        <button
          type="button"
          className={`${styles.navItem} ${isActive("/lis/result-entry") ? styles.navItemActive : ""}`}
          onClick={() => navigate("/lis/result-entry")}
        >
          결과 입력
        </button>
      </nav>
      <div className={styles.footer}>v0.1</div>
    </aside>
  );
};

export default LisSidebar;
