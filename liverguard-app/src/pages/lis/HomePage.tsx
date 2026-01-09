import React from "react";
import LisSidebar from "../../components/lis/LisSidebar";
import styles from "./HomePage.module.css";

const LisHomePage: React.FC = () => {
  return (
    <div className={styles.page}>
      <LisSidebar />
      <main className={styles.main}>
        <h1 className={styles.title}>LIS Home</h1>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>오늘의 작업</div>
          <div className={styles.panelBody}>
            검사 접수와 결과 입력 흐름을 확인할 수 있는 기본 화면입니다.
          </div>
        </section>
      </main>
    </div>
  );
};

export default LisHomePage;
