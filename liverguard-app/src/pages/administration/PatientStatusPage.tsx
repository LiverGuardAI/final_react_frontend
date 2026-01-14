// src/pages/administration/PatientStatusPage.tsx
import React from "react";
import styles from "./PatientStatusPage.module.css";

const PatientStatusPage: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>환자 현황</h2>
      </div>

      <div className={styles.content}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>📊</div>
          <h3 className={styles.placeholderTitle}>환자 현황 페이지</h3>
          <p className={styles.placeholderText}>
            환자 현황 관리 기능이 준비 중입니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientStatusPage;