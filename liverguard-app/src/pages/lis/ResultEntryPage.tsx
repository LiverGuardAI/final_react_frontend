import React, { useEffect, useState } from "react";
import LisSidebar from "../../components/lis/LisSidebar";
import * as adminApi from "../../api/administration_api";
import {
  createGenomicData,
  createLabResult,
  type CreateGenomicDataPayload,
  type CreateLabResultPayload,
} from "../../api/doctorApi";
import styles from "./HomePage.module.css";

const LisResultEntryPage: React.FC = () => {
  const pathwayKeys = [
    "Myc Targets V1",
    "G2-M Checkpoint",
    "Glycolysis",
    "Spermatogenesis",
    "mTORC1 Signaling",
    "E2F Targets",
    "Unfolded Protein Response",
    "Mitotic Spindle",
    "Bile Acid Metabolism",
    "PI3K/AKT/mTOR Signaling",
    "KRAS Signaling Dn",
    "Myc Targets V2",
    "UV Response Up",
    "Xenobiotic Metabolism",
    "Coagulation",
    "Fatty Acid Metabolism",
    "Adipogenesis",
    "Reactive Oxygen Species Pathway",
    "DNA Repair",
    "Oxidative Phosphorylation",
  ];

  type PatientItem = {
    patient_id: string;
    name: string;
    date_of_birth?: string;
  };

  type LabFormState = {
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

  type GenomicFormState = {
    sampleDate: string;
    measuredAt: string;
    pathwayScores: Record<string, string>;
  };

  const [patientList, setPatientList] = useState<PatientItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [activeTab, setActiveTab] = useState<"lab" | "genomic">("lab");

  const [labForm, setLabForm] = useState<LabFormState>({
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

  const [genomicForm, setGenomicForm] = useState<GenomicFormState>({
    sampleDate: "",
    measuredAt: "",
    pathwayScores: pathwayKeys.reduce<Record<string, string>>((acc, key) => {
      acc[key] = "";
      return acc;
    }, {}),
  });

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await adminApi.getPatients();
        setPatientList(data.results || data);
      } catch (error) {
        console.error("Failed to load patients:", error);
        setPatientList([]);
      }
    };
    loadPatients();
  }, []);

  const handleLabChange = (field: keyof LabFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setLabForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleGenomicChange = (field: keyof GenomicFormState) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setGenomicForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handlePathwayChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setGenomicForm((prev) => ({
      ...prev,
      pathwayScores: {
        ...prev.pathwayScores,
        [key]: event.target.value,
      },
    }));
  };

  const handleLabSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPatientId) {
      alert("환자를 먼저 선택해주세요.");
      return;
    }
    if (!labForm.testDate) {
      alert("검사 날짜를 입력해주세요.");
      return;
    }
    const payload: CreateLabResultPayload = {
      test_date: labForm.testDate,
    };
    if (labForm.measuredAt) payload.measured_at = labForm.measuredAt;
    if (labForm.afp) payload.afp = Number(labForm.afp);
    if (labForm.albumin) payload.albumin = Number(labForm.albumin);
    if (labForm.bilirubinTotal) payload.bilirubin_total = Number(labForm.bilirubinTotal);
    if (labForm.ptInr) payload.pt_inr = Number(labForm.ptInr);
    if (labForm.platelet) payload.platelet = Number(labForm.platelet);
    if (labForm.creatinine) payload.creatinine = Number(labForm.creatinine);
    if (labForm.childPughClass) payload.child_pugh_class = labForm.childPughClass;
    if (labForm.meldScore) payload.meld_score = Number(labForm.meldScore);
    if (labForm.albiScore) payload.albi_score = Number(labForm.albiScore);
    if (labForm.albiGrade) payload.albi_grade = labForm.albiGrade;

    createLabResult(selectedPatientId, payload)
      .then(() => {
        alert("혈액검사 결과가 저장되었습니다.");
      })
      .catch((error) => {
        console.error("Failed to save lab result:", error);
        alert("혈액검사 결과 저장에 실패했습니다.");
      });
  };

  const handleGenomicSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPatientId) {
      alert("환자를 먼저 선택해주세요.");
      return;
    }
    if (!genomicForm.sampleDate) {
      alert("검사 날짜를 입력해주세요.");
      return;
    }
    const pathwayScores: Record<string, number> = {};
    pathwayKeys.forEach((key) => {
      const value = genomicForm.pathwayScores[key];
      if (value !== "") {
        pathwayScores[key] = Number(value);
      }
    });

    const payload: CreateGenomicDataPayload = {
      sample_date: genomicForm.sampleDate,
    };
    if (genomicForm.measuredAt) payload.measured_at = genomicForm.measuredAt;
    if (Object.keys(pathwayScores).length > 0) {
      payload.pathway_scores = pathwayScores;
    }

    createGenomicData(selectedPatientId, payload)
      .then(() => {
        alert("조직검사 결과가 저장되었습니다.");
      })
      .catch((error) => {
        console.error("Failed to save genomic data:", error);
        alert("조직검사 결과 저장에 실패했습니다.");
      });
  };

  return (
    <div className={styles.page}>
      <LisSidebar />
      <main className={styles.main}>
        <h1 className={styles.title}>결과 입력</h1>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>환자 선택</div>
          <div className={styles.selectionRow}>
            <label className={styles.formLabel} htmlFor="lisPatientSelect">환자</label>
            <select
              id="lisPatientSelect"
              className={styles.formInput}
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
            >
              <option value="">- 환자를 선택하세요 -</option>
              {patientList.map((patient) => (
                <option key={patient.patient_id} value={patient.patient_id}>
                  {patient.name} ({patient.patient_id})
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>결과 입력</div>
          <div className={styles.tabBar}>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === "lab" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("lab")}
            >
              혈액검사
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === "genomic" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("genomic")}
            >
              조직검사
            </button>
          </div>

          {activeTab === "lab" ? (
            <form className={`${styles.formPanel}`} onSubmit={handleLabSubmit}>
              <div className={styles.panelTitle}>LabResult 입력</div>
              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="labPatientId">patient_id *</label>
                  <input
                    id="labPatientId"
                    className={styles.formInput}
                    value={selectedPatientId}
                    readOnly
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="testDate">test_date *</label>
                  <input
                    id="testDate"
                    type="date"
                    className={styles.formInput}
                    value={labForm.testDate}
                    onChange={handleLabChange("testDate")}
                    required
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="measuredAt">measured_at</label>
                  <input
                    id="measuredAt"
                    type="datetime-local"
                    className={styles.formInput}
                    value={labForm.measuredAt}
                    onChange={handleLabChange("measuredAt")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="afp">afp</label>
                  <input
                    id="afp"
                    type="number"
                    step="0.01"
                    className={styles.formInput}
                    value={labForm.afp}
                    onChange={handleLabChange("afp")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="albumin">albumin</label>
                  <input
                    id="albumin"
                    type="number"
                    step="0.01"
                    className={styles.formInput}
                    value={labForm.albumin}
                    onChange={handleLabChange("albumin")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="bilirubinTotal">bilirubin_total</label>
                  <input
                    id="bilirubinTotal"
                    type="number"
                    step="0.01"
                    className={styles.formInput}
                    value={labForm.bilirubinTotal}
                    onChange={handleLabChange("bilirubinTotal")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="ptInr">pt_inr</label>
                  <input
                    id="ptInr"
                    type="number"
                    step="0.01"
                    className={styles.formInput}
                    value={labForm.ptInr}
                    onChange={handleLabChange("ptInr")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="platelet">platelet</label>
                  <input
                    id="platelet"
                    type="number"
                    className={styles.formInput}
                    value={labForm.platelet}
                    onChange={handleLabChange("platelet")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="creatinine">creatinine</label>
                  <input
                    id="creatinine"
                    type="number"
                    step="0.01"
                    className={styles.formInput}
                    value={labForm.creatinine}
                    onChange={handleLabChange("creatinine")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="childPughClass">child_pugh_class</label>
                  <select
                    id="childPughClass"
                    className={styles.formInput}
                    value={labForm.childPughClass}
                    onChange={handleLabChange("childPughClass")}
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
                    value={labForm.meldScore}
                    onChange={handleLabChange("meldScore")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="albiScore">albi_score</label>
                  <input
                    id="albiScore"
                    type="number"
                    step="0.001"
                    className={styles.formInput}
                    value={labForm.albiScore}
                    onChange={handleLabChange("albiScore")}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="albiGrade">albi_grade</label>
                  <select
                    id="albiGrade"
                    className={styles.formInput}
                    value={labForm.albiGrade}
                    onChange={handleLabChange("albiGrade")}
                  >
                    <option value="">선택</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton}>
                  저장
                </button>
              </div>
            </form>
          ) : (
            <form className={`${styles.formPanel}`} onSubmit={handleGenomicSubmit}>
              <div className={styles.panelTitle}>GenomicData 입력</div>
              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="genomicPatientId">patient_id *</label>
                  <input
                    id="genomicPatientId"
                    className={styles.formInput}
                    value={selectedPatientId}
                    readOnly
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="sampleDate">sample_date *</label>
                  <input
                    id="sampleDate"
                    type="date"
                    className={styles.formInput}
                    value={genomicForm.sampleDate}
                    onChange={handleGenomicChange("sampleDate")}
                    required
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel} htmlFor="genomicMeasuredAt">measured_at</label>
                  <input
                    id="genomicMeasuredAt"
                    type="datetime-local"
                    className={styles.formInput}
                    value={genomicForm.measuredAt}
                    onChange={handleGenomicChange("measuredAt")}
                  />
                </div>
              </div>
              <div className={styles.panelTitle}>Pathway Scores</div>
              <div className={`${styles.formGrid} ${styles.pathwayGrid}`}>
                {pathwayKeys.map((key) => (
                  <div className={styles.formRow} key={key}>
                    <label className={styles.formLabel} htmlFor={`pathway-${key}`}>
                      {key}
                    </label>
                    <input
                      id={`pathway-${key}`}
                      type="number"
                      step="0.001"
                      className={styles.formInput}
                      value={genomicForm.pathwayScores[key]}
                      onChange={handlePathwayChange(key)}
                    />
                  </div>
                ))}
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton}>
                  저장
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};

export default LisResultEntryPage;
