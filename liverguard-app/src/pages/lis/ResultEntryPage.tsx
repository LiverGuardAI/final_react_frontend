import React, { useState } from "react";
import LisSidebar from "../../components/lis/LisSidebar";
import styles from "./HomePage.module.css";

const LisResultEntryPage: React.FC = () => {
  const bloodEntries = [
    { order: 1, name: "김민수", birthDate: "1985-04-12" },
    { order: 2, name: "박지영", birthDate: "1992-11-03" },
  ];

  const tissueEntries = [
    { order: 1, name: "최서연", birthDate: "1989-02-18" },
    { order: 2, name: "정도윤", birthDate: "1971-09-07" },
  ];

  type FormState = {
    patientId: string;
    encounterId: string;
    testDate: string;
    measuredAt: string;
    afp: string;
    albumin: string;
    bilirubinTotal: string;
    ptInr: string;
    platelet: string;
    creatinine: string;
    childPughClass: string;
    meldScore: string;
    albiScore: string;
    albiGrade: string;
  };

  const [activeEntry, setActiveEntry] = useState<{ name: string; birthDate: string } | null>(null);
  const [formState, setFormState] = useState<FormState>({
    patientId: "",
    encounterId: "",
    testDate: "",
    measuredAt: "",
    afp: "",
    albumin: "",
    bilirubinTotal: "",
    ptInr: "",
    platelet: "",
    creatinine: "",
    childPughClass: "",
    meldScore: "",
    albiScore: "",
    albiGrade: "",
  });

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormState((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const openLabResultForm = (entry: { name: string; birthDate: string }) => {
    setActiveEntry(entry);
  };

  const closeLabResultForm = () => {
    setActiveEntry(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("LabResult form data:", formState);
    alert("혈액검사 결과가 저장될 예정입니다.");
    closeLabResultForm();
  };

  return (
    <div className={styles.page}>
      <LisSidebar />
      <main className={styles.main}>
        <h1 className={styles.title}>결과 입력</h1>
        <div className={styles.splitPanels}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>혈액검사 결과 입력</div>
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
                {bloodEntries.map((item) => (
                  <tr key={`blood-entry-${item.order}`}>
                    <td>{item.order}</td>
                    <td>{item.name}</td>
                    <td>{item.birthDate}</td>
                  <td>
                    <div className={styles.listActions}>
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionPrimary}`}
                        onClick={() => openLabResultForm(item)}
                      >
                        결과 입력
                      </button>
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>조직검사 결과 입력</div>
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
                {tissueEntries.map((item) => (
                  <tr key={`tissue-entry-${item.order}`}>
                    <td>{item.order}</td>
                    <td>{item.name}</td>
                    <td>{item.birthDate}</td>
                    <td>
                      <div className={styles.listActions}>
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.actionDisabled}`}
                          disabled
                        >
                          결과 입력
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        {activeEntry && (
          <div className={styles.modalOverlay} role="dialog" aria-modal="true">
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>혈액검사 결과 입력</div>
                <button type="button" className={styles.modalClose} onClick={closeLabResultForm}>
                  닫기
                </button>
              </div>
              <div className={styles.infoBox}>
                <span>환자 이름: {activeEntry.name}</span>
                <span> · </span>
                <span>생년월일: {activeEntry.birthDate}</span>
              </div>
              <form className={`${styles.panel} ${styles.formPanel}`} onSubmit={handleSubmit}>
                <div className={styles.panelTitle}>LabResult 입력</div>
                <div className={styles.formGrid}>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="patientId">patient_id *</label>
                    <input
                      id="patientId"
                      className={styles.formInput}
                      value={formState.patientId}
                      onChange={handleChange("patientId")}
                      required
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="encounterId">encounter_id</label>
                    <input
                      id="encounterId"
                      className={styles.formInput}
                      value={formState.encounterId}
                      onChange={handleChange("encounterId")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="testDate">test_date *</label>
                    <input
                      id="testDate"
                      type="date"
                      className={styles.formInput}
                      value={formState.testDate}
                      onChange={handleChange("testDate")}
                      required
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="measuredAt">measured_at</label>
                    <input
                      id="measuredAt"
                      type="datetime-local"
                      className={styles.formInput}
                      value={formState.measuredAt}
                      onChange={handleChange("measuredAt")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="afp">afp</label>
                    <input
                      id="afp"
                      type="number"
                      step="0.01"
                      className={styles.formInput}
                      value={formState.afp}
                      onChange={handleChange("afp")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="albumin">albumin</label>
                    <input
                      id="albumin"
                      type="number"
                      step="0.01"
                      className={styles.formInput}
                      value={formState.albumin}
                      onChange={handleChange("albumin")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="bilirubinTotal">bilirubin_total</label>
                    <input
                      id="bilirubinTotal"
                      type="number"
                      step="0.01"
                      className={styles.formInput}
                      value={formState.bilirubinTotal}
                      onChange={handleChange("bilirubinTotal")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="ptInr">pt_inr</label>
                    <input
                      id="ptInr"
                      type="number"
                      step="0.01"
                      className={styles.formInput}
                      value={formState.ptInr}
                      onChange={handleChange("ptInr")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="platelet">platelet</label>
                    <input
                      id="platelet"
                      type="number"
                      className={styles.formInput}
                      value={formState.platelet}
                      onChange={handleChange("platelet")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="creatinine">creatinine</label>
                    <input
                      id="creatinine"
                      type="number"
                      step="0.01"
                      className={styles.formInput}
                      value={formState.creatinine}
                      onChange={handleChange("creatinine")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="childPughClass">child_pugh_class</label>
                    <select
                      id="childPughClass"
                      className={styles.formInput}
                      value={formState.childPughClass}
                      onChange={handleChange("childPughClass")}
                    >
                      <option value="">선택</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="meldScore">meld_score</label>
                    <input
                      id="meldScore"
                      type="number"
                      className={styles.formInput}
                      value={formState.meldScore}
                      onChange={handleChange("meldScore")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="albiScore">albi_score</label>
                    <input
                      id="albiScore"
                      type="number"
                      step="0.001"
                      className={styles.formInput}
                      value={formState.albiScore}
                      onChange={handleChange("albiScore")}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="albiGrade">albi_grade</label>
                    <select
                      id="albiGrade"
                      className={styles.formInput}
                      value={formState.albiGrade}
                      onChange={handleChange("albiGrade")}
                    >
                      <option value="">선택</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="button" className={styles.secondaryButton} onClick={closeLabResultForm}>
                    취소
                  </button>
                  <button type="submit" className={styles.primaryButton}>
                    저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LisResultEntryPage;
