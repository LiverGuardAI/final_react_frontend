import { useState, useEffect } from 'react';
import styles from './TreatmentPage.module.css';
import { useTreatment } from '../../contexts/TreatmentContext';
import {
  getEncounterDetail,
  getPatientEncounterHistory,
  getPatientLabResults,
  getPatientImagingOrders,
  getDoctorInProgressEncounter,
} from '../../api/doctorApi';
import type { EncounterDetail, LabResult, ImagingOrder } from '../../api/doctorApi';

export default function TreatmentPage() {
  const { selectedEncounterId, setSelectedEncounterId } = useTreatment();
  const [currentEncounter, setCurrentEncounter] = useState<EncounterDetail | null>(null);
  const [encounterHistory, setEncounterHistory] = useState<EncounterDetail[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // 왼쪽 섹션 탭 (진료기록/문진표)
  const [leftTab, setLeftTab] = useState<'records' | 'questionnaire'>('records');
  // 오른쪽 섹션 탭 (진료기록 작성/처방전 작성)
  const [rightTab, setRightTab] = useState<'record' | 'prescription'>('record');

  // 진료 작성 폼 state
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosisName, setDiagnosisName] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [nextVisitDate, setNextVisitDate] = useState('');

  // HCC 진단 상세 정보 state
  const [hccDetails, setHccDetails] = useState({
    ajcc_stage: '',
    ajcc_t: '',
    ajcc_n: '',
    ajcc_m: '',
    grade: '',
    vascular_invasion: '',
    ishak_score: '',
    hepatic_inflammation: '',
    ecog_score: '',
    tumor_status: ''
  });

  // 진단명에 따라 HCC 진단인지 확인
  const isHCCDiagnosis = diagnosisName.toLowerCase().includes('hcc') ||
                         diagnosisName.toLowerCase().includes('간암') ||
                         diagnosisName.toLowerCase().includes('hepatocellular');

  // 진행 중인 encounter 자동 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    const loadInProgressEncounter = async () => {
      if (!selectedEncounterId) {
        try {
          const doctorInfo = localStorage.getItem('doctor');
          if (doctorInfo) {
            const doctor = JSON.parse(doctorInfo);
            const inProgressEncounter = await getDoctorInProgressEncounter(doctor.doctor_id);
            if (inProgressEncounter) {
              setSelectedEncounterId(inProgressEncounter.encounter_id);
            }
          }
        } catch (error) {
          console.error('진행중인 encounter 로드 실패:', error);
        }
      }
    };
    loadInProgressEncounter();
  }, []); // 빈 의존성 배열 = 컴포넌트 마운트 시 한 번만 실행

  // Encounter 데이터 로드
  useEffect(() => {
    if (selectedEncounterId) {
      loadEncounterData(selectedEncounterId);
    }
  }, [selectedEncounterId]);

  const loadEncounterData = async (encounterId: number) => {
    setLoading(true);
    try {
      // 현재 encounter 상세 정보 로드
      const encounterData = await getEncounterDetail(encounterId);
      setCurrentEncounter(encounterData);

      const patientId = encounterData.patient.patient_id;

      // 환자의 과거 진료 기록 로드
      const historyResponse = await getPatientEncounterHistory(patientId, 10);
      // 현재 encounter 제외
      const filteredHistory = historyResponse.results.filter(
        (enc) => enc.encounter_id !== encounterId
      );
      setEncounterHistory(filteredHistory);

      // 혈액 검사 결과 로드
      const labResponse = await getPatientLabResults(patientId, 5);
      setLabResults(labResponse.results);

      // 영상 검사 결과 로드
      const imagingResponse = await getPatientImagingOrders(patientId, 5);
      setImagingOrders(imagingResponse.results);

      // 현재 encounter의 기존 데이터로 폼 초기화
      if (encounterData.chief_complaint) {
        setChiefComplaint(encounterData.chief_complaint);
      }
      if (encounterData.clinical_notes) {
        setClinicalNotes(encounterData.clinical_notes);
      }
      if (encounterData.diagnosis_name) {
        setDiagnosisName(encounterData.diagnosis_name);
      }
      if (encounterData.next_visit_date) {
        setNextVisitDate(encounterData.next_visit_date);
      }
    } catch (error) {
      console.error('Encounter 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderToggle = (order: string) => {
    setSelectedOrders((prev) =>
      prev.includes(order) ? prev.filter((o) => o !== order) : [...prev, order]
    );
  };

  if (!selectedEncounterId) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>🩺</div>
        <h2>진료할 환자를 선택하세요.</h2>
        <p>좌측 사이드바에서 환자를 선택하고 '진료시작' 버튼을 눌러주세요.</p>
      </div>
    );
  }

  if (loading || !currentEncounter) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>환자 정보를 불러오는 중...</p>
      </div>
    );
  }

  const patient = currentEncounter.patient;

  return (
      <div className={styles.treatmentContainer}>
        {/* 환자 정보 헤더 */}
        <div className={styles.patientHeader}>
          <div className={styles.patientInfo}>
            <div className={styles.patientName}>
              <h1>{patient.name}</h1>
              <span>({patient.gender === 'M' ? '남' : '여'}{patient.age ? `, ${patient.age}세` : ''})</span>
            </div>
            <div className={styles.patientInfoItem}>{patient.patient_id}</div>
            <div className={styles.patientInfoItem}>생년월일: {patient.date_of_birth || 'N/A'}</div>
            <div className={styles.patientInfoItem}>연락처: {patient.phone || 'N/A'}</div>
            {labResults.length > 0 && (
              <div className={styles.testBadges}>
                <span className={`${styles.testBadge} ${styles.completed}`}>
                  혈액검사 완료 ({labResults[0].test_date})
                </span>
              </div>
            )}
            {imagingOrders.length > 0 && imagingOrders[0].status === 'COMPLETED' && (
              <div className={styles.testBadges}>
                <span className={`${styles.testBadge} ${styles.ct}`}>
                  {imagingOrders[0].modality} 완료 ({new Date(imagingOrders[0].ordered_at).toLocaleDateString()})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 메인 2단 레이아웃 (50:50) */}
        <div className={styles.mainLayout}>
          {/* 왼쪽: 진료 기록 & 검사 결과 */}
          <div className={styles.leftSection}>
            {/* 탭 헤더 */}
            <div className={styles.leftTabHeader}>
              <button
                onClick={() => setLeftTab('records')}
                className={`${styles.leftTabButton} ${leftTab === 'records' ? styles.active : ''}`}
              >
                진료기록
              </button>
              <button
                onClick={() => setLeftTab('questionnaire')}
                className={`${styles.leftTabButton} ${leftTab === 'questionnaire' ? styles.active : ''}`}
              >
                문진표
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div className={styles.leftTabContent}>
              {leftTab === 'records' ? (
                <>
                  {/* 이전 진료기록 */}
                  <div className={styles.recordCard}>
                    <h3>📋 과거 진료기록</h3>
                    <div className={styles.recordList}>
                      {encounterHistory.length > 0 ? (
                        encounterHistory.map((encounter) => (
                          <div key={encounter.encounter_id} className={styles.recordItem}>
                            <div className={styles.recordDate}>
                              {encounter.encounter_date} {encounter.encounter_time}
                            </div>
                            <div className={styles.recordDetail}>
                              • 담당의사: {encounter.doctor_name}
                            </div>
                            <div className={styles.recordDetail}>
                              • 주증상: {encounter.chief_complaint || 'N/A'}
                            </div>
                            <div className={styles.recordDetail}>
                              • 진단명: {encounter.diagnosis_name || 'N/A'}
                            </div>
                            <div className={styles.recordDetail}>
                              • 오더: {encounter.lab_recorded ? '혈액검사 ' : ''}
                              {encounter.ct_recorded ? 'CT촬영 ' : ''}
                            </div>
                            <button className={styles.detailButton}>상세보기</button>
                          </div>
                        ))
                      ) : (
                        <div className={styles.emptyRecord}>과거 진료 기록이 없습니다.</div>
                      )}
                    </div>
                  </div>

                  {/* 검사 결과 */}
                  <div className={styles.recordCard}>
                    <h3>🧪 검사결과</h3>
                    {labResults.length > 0 && (
                      <>
                        <div className={styles.testResultTitle}>
                          혈액검사 ({labResults[0].test_date})
                        </div>
                        <div className={styles.testResultGrid}>
                          <div>AFP: {labResults[0].afp || 'N/A'}</div>
                          <div>알부민: {labResults[0].albumin || 'N/A'}</div>
                          <div>빌리루빈: {labResults[0].bilirubin_total || 'N/A'}</div>
                          <div>INR: {labResults[0].pt_inr || 'N/A'}</div>
                        </div>
                        <button className={`${styles.viewButton} ${styles.lab}`}>전체보기</button>
                      </>
                    )}
                    {imagingOrders.length > 0 && (
                      <>
                        <div className={styles.testResultTitle} style={{ marginTop: '15px' }}>
                          {imagingOrders[0].modality} 영상 ({new Date(imagingOrders[0].ordered_at).toLocaleDateString()})
                        </div>
                        <button className={`${styles.viewButton} ${styles.ct}`}>영상 보기</button>
                      </>
                    )}
                    {labResults.length === 0 && imagingOrders.length === 0 && (
                      <div className={styles.emptyRecord}>검사 결과가 없습니다.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.questionnaireContent}>
                  <h3>📝 문진표</h3>
                  {currentEncounter.questionnaire_data ? (
                    <div className={styles.questionnaireData}>
                      <pre>{JSON.stringify(currentEncounter.questionnaire_data, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className={styles.emptyRecord}>문진표 데이터가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 오늘 진료 작성 */}
          <div className={styles.rightSection}>
            <div className={styles.writeCard}>
              {/* 탭 헤더 */}
              <div className={styles.tabHeader}>
                <div className={styles.tabButtons}>
                  <button
                    onClick={() => setRightTab('record')}
                    className={`${styles.tabButton} ${rightTab === 'record' ? styles.active : ''}`}
                  >
                    진료기록 작성
                  </button>
                  <button
                    onClick={() => setRightTab('prescription')}
                    className={`${styles.tabButton} ${rightTab === 'prescription' ? styles.active : ''}`}
                  >
                    처방전 작성
                  </button>
                </div>
              </div>

              {/* 탭 컨텐츠 */}
              <div className={styles.tabContent}>
                {rightTab === 'record' ? (
                  <div className={styles.formSection}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>주증상</label>
                      <input
                        type="text"
                        placeholder="환자의 주증상을 입력하세요"
                        className={styles.formInput}
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <div className={styles.formLabelRow}>
                        <label className={styles.formLabel}>진료 내용</label>
                        <button className={styles.aiButton}>🤖 AI 제안</button>
                      </div>
                      <textarea
                        placeholder="진료 내용을 입력하세요"
                        className={styles.formTextarea}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>검사 오더</label>
                      <div className={styles.orderCheckboxes}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes('혈액검사')}
                            onChange={() => handleOrderToggle('혈액검사')}
                          />
                          <span>혈액검사</span>
                        </label>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes('CT 촬영')}
                            onChange={() => handleOrderToggle('CT 촬영')}
                          />
                          <span>CT 촬영</span>
                        </label>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes('유전체 검사')}
                            onChange={() => handleOrderToggle('유전체 검사')}
                          />
                          <span>유전체 검사</span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>진단명</label>
                      <input
                        type="text"
                        placeholder="진단명 입력 (예: HCC, 간암)"
                        className={styles.formInput}
                        value={diagnosisName}
                        onChange={(e) => setDiagnosisName(e.target.value)}
                      />
                    </div>

                    {/* HCC 진단 상세 정보 */}
                    {isHCCDiagnosis && (
                      <div className={styles.hccDetailsSection}>
                        <h4 className={styles.sectionSubtitle}>HCC 진단 상세 정보</h4>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>AJCC Stage</label>
                            <input
                              type="text"
                              placeholder="예: Stage IIA"
                              className={styles.formInput}
                              value={hccDetails.ajcc_stage}
                              onChange={(e) => setHccDetails({...hccDetails, ajcc_stage: e.target.value})}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Grade</label>
                            <input
                              type="text"
                              placeholder="예: G2"
                              className={styles.formInput}
                              value={hccDetails.grade}
                              onChange={(e) => setHccDetails({...hccDetails, grade: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>AJCC T</label>
                            <input
                              type="text"
                              placeholder="예: T2"
                              className={styles.formInput}
                              value={hccDetails.ajcc_t}
                              onChange={(e) => setHccDetails({...hccDetails, ajcc_t: e.target.value})}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>AJCC N</label>
                            <input
                              type="text"
                              placeholder="예: N0"
                              className={styles.formInput}
                              value={hccDetails.ajcc_n}
                              onChange={(e) => setHccDetails({...hccDetails, ajcc_n: e.target.value})}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>AJCC M</label>
                            <input
                              type="text"
                              placeholder="예: M0"
                              className={styles.formInput}
                              value={hccDetails.ajcc_m}
                              onChange={(e) => setHccDetails({...hccDetails, ajcc_m: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Vascular Invasion</label>
                            <select
                              className={styles.formInput}
                              value={hccDetails.vascular_invasion}
                              onChange={(e) => setHccDetails({...hccDetails, vascular_invasion: e.target.value})}
                            >
                              <option value="">선택</option>
                              <option value="None">None</option>
                              <option value="Micro">Micro</option>
                              <option value="Macro">Macro</option>
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Ishak Score</label>
                            <input
                              type="number"
                              placeholder="0-6"
                              min="0"
                              max="6"
                              className={styles.formInput}
                              value={hccDetails.ishak_score}
                              onChange={(e) => setHccDetails({...hccDetails, ishak_score: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Hepatic Inflammation</label>
                            <input
                              type="text"
                              placeholder="예: Mild"
                              className={styles.formInput}
                              value={hccDetails.hepatic_inflammation}
                              onChange={(e) => setHccDetails({...hccDetails, hepatic_inflammation: e.target.value})}
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>ECOG Score</label>
                            <select
                              className={styles.formInput}
                              value={hccDetails.ecog_score}
                              onChange={(e) => setHccDetails({...hccDetails, ecog_score: e.target.value})}
                            >
                              <option value="">선택</option>
                              <option value="0">0 - 완전한 활동 가능</option>
                              <option value="1">1 - 제한적 활동 가능</option>
                              <option value="2">2 - 보행 가능, 자가 돌봄 가능</option>
                              <option value="3">3 - 제한적 자가 돌봄</option>
                              <option value="4">4 - 완전 와상</option>
                            </select>
                          </div>
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Tumor Status</label>
                          <input
                            type="text"
                            placeholder="종양 상태 입력"
                            className={styles.formInput}
                            value={hccDetails.tumor_status}
                            onChange={(e) => setHccDetails({...hccDetails, tumor_status: e.target.value})}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className={styles.buttonGroup}>
                      <button className={styles.tempSaveButton}>임시저장</button>
                      <button className={styles.submitButton}>진료완료</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.formSection}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>처방 약물</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className={styles.prescriptionRow}>
                          <input type="text" placeholder="약물명" />
                          <input type="text" placeholder="용량" />
                          <input type="text" placeholder="1일 3회" />
                          <input type="number" placeholder="7일" />
                          <button className={styles.deleteButton}>✕</button>
                        </div>
                      </div>
                      <button className={styles.addButton}>+ 약물 추가</button>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>복약 지도</label>
                      <textarea
                        placeholder="복약 지도 사항을 입력하세요"
                        className={styles.formTextarea}
                        style={{ minHeight: '100px' }}
                      />
                    </div>

                    <div className={styles.buttonGroup}>
                      <button className={styles.tempSaveButton}>임시저장</button>
                      <button className={styles.submitButton}>처방완료</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
