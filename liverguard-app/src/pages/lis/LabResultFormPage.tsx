import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import LisSidebar from "../../components/lis/LisSidebar";
import styles from "./HomePage.module.css";

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

const LisLabResultFormPage: React.FC = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const patientName = params.get("name") || "";
  const birthDate = params.get("birthDate") || "";

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("LabResult form data:", formState);
    alert("혈액검사 결과가 저장될 예정입니다.");
  };

  const handleReset = () => {
    setFormState({
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
  };

  return (
    <div className={styles.page}>
      <LisSidebar />
      <main className={styles.main}>
        <h1 className={styles.title}>혈액검사 결과 입력</h1>
        {(patientName || birthDate) && (
          <div className={styles.infoBox}>
            {patientName && <span>환자 이름: {patientName}</span>}
            {patientName && birthDate && <span> · </span>}
            {birthDate && <span>생년월일: {birthDate}</span>}
          </div>
        )}
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
            <button type="button" className={styles.secondaryButton} onClick={handleReset}>
              초기화
            </button>
            <button type="submit" className={styles.primaryButton}>
              저장
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default LisLabResultFormPage;
