import React from "react";
import LisSidebar from "../../components/lis/LisSidebar";
import styles from "../../pages/administration/Dashboard.module.css";

const LisReceptionPage: React.FC = () => {
  const bloodReceipts = [
    { order: 1, name: "김민수", birthDate: "1985-04-12" },
    { order: 2, name: "박지영", birthDate: "1992-11-03" },
    { order: 3, name: "이현우", birthDate: "1978-06-25" },
  ];

  const tissueReceipts = [
    { order: 1, name: "최서연", birthDate: "1989-02-18" },
    { order: 2, name: "정도윤", birthDate: "1971-09-07" },
    { order: 3, name: "한지훈", birthDate: "1995-12-30" },
  ];

  return (
    <div className={styles.page}>
      <LisSidebar />
      <main className={styles.main}>
        <h1 className={styles.title}>검사 접수</h1>
        <div className={styles.splitPanels}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>혈액검사 접수 목록</div>
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>순번</th>
                  <th>환자 이름</th>
                  <th>생년월일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {bloodReceipts.map((item) => (
                  <tr key={`blood-${item.order}`}>
                    <td>{item.order}</td>
                    <td>{item.name}</td>
                    <td>{item.birthDate}</td>
                    <td>
                      <div className={styles.listActions}>
                        <button type="button" className={`${styles.actionButton} ${styles.actionPrimary}`}>
                          출력
                        </button>
                        <button type="button" className={`${styles.actionButton} ${styles.actionDanger}`}>
                          종료
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>조직검사 접수 목록</div>
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>순번</th>
                  <th>환자 이름</th>
                  <th>생년월일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {tissueReceipts.map((item) => (
                  <tr key={`tissue-${item.order}`}>
                    <td>{item.order}</td>
                    <td>{item.name}</td>
                    <td>{item.birthDate}</td>
                    <td>
                      <div className={styles.listActions}>
                        <button type="button" className={`${styles.actionButton} ${styles.actionPrimary}`}>
                          출력
                        </button>
                        <button type="button" className={`${styles.actionButton} ${styles.actionDanger}`}>
                          종료
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LisReceptionPage;
