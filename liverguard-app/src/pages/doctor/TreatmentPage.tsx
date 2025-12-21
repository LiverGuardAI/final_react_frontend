import { useState } from 'react';
import styles from './TreatmentPage.module.css';

export default function TreatmentPage() {
  const [recordTab, setRecordTab] = useState<'record' | 'prescription'>('record');
  const [diagnosisName, setDiagnosisName] = useState('');

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

  return (
    <div className={styles.container}>
      {/* 환자 정보 헤더 */}
      <div className={styles.patientHeader}>
        <div className={styles.patientInfo}>
          <div className={styles.patientName}>
            <h1>정예진</h1>
            <span>(여, 29세)</span>
          </div>
          <div className={styles.patientInfoItem}>000521-4*****</div>
          <div className={styles.patientInfoItem}>BP 120/80</div>
          <div className={styles.patientInfoItem}>키 180cm</div>
          <div className={styles.patientInfoItem}>체중 80kg</div>
          <div className={styles.testBadges}>
            <span className={`${styles.testBadge} ${styles.completed}`}>혈액검사 완료 (2024-12-01)</span>
            <span className={`${styles.testBadge} ${styles.ct}`}>CT 완료 (2024-11-15)</span>
          </div>
        </div>
      </div>

      {/* 메인 2단 레이아웃 */}
      <div className={styles.mainLayout}>
        {/* 왼쪽: 이전 기록 */}
        <div className={styles.leftSection}>
          {/* 이전 진료기록 */}
          <div className={styles.recordCard}>
            <h3>📋 진료기록</h3>
            <div className={styles.recordList}>
              <div className={styles.recordItem}>
                <div className={styles.recordDate}>2024-12-01</div>
                <div className={styles.recordDetail}>• HCC 진단</div>
                <div className={styles.recordDetail}>• 복부 통증</div>
                <div className={styles.recordDetail}>• 혈액검사 완료</div>
                <button className={styles.detailButton}>상세보기</button>
              </div>
              <div className={styles.recordItem}>
                <div className={styles.recordDate}>2024-11-15</div>
                <div className={styles.recordDetail}>• 정기 검진</div>
                <div className={styles.recordDetail}>• CT 촬영 완료</div>
                <button className={styles.detailButton}>상세보기</button>
              </div>
            </div>
          </div>

          {/* 검사 결과 */}
          <div className={styles.recordCard}>
            <h3>🧪 검사결과</h3>
            <div className={styles.testResultTitle}>혈액검사 (2024-12-01)</div>
            <div className={styles.testResultGrid}>
              <div>AFP: 15.2</div>
              <div>알부민: 3.8</div>
              <div>빌리루빈: 1.2</div>
              <div>INR: 1.1</div>
            </div>
            <button className={`${styles.viewButton} ${styles.lab}`}>전체보기</button>

            <div className={styles.testResultTitle} style={{ marginTop: '15px' }}>CT 영상 (2024-11-15)</div>
            <button className={`${styles.viewButton} ${styles.ct}`}>영상 보기</button>
          </div>
        </div>

        {/* 오른쪽: 오늘 진료 작성 */}
        <div className={styles.rightSection}>
          <div className={styles.writeCard}>
            {/* 탭 헤더 */}
            <div className={styles.tabHeader}>
              <div className={styles.tabButtons}>
                <button
                  onClick={() => setRecordTab('record')}
                  className={`${styles.tabButton} ${recordTab === 'record' ? styles.active : ''}`}
                >
                  진료기록 작성
                </button>
                <button
                  onClick={() => setRecordTab('prescription')}
                  className={`${styles.tabButton} ${recordTab === 'prescription' ? styles.active : ''}`}
                >
                  처방전 작성
                </button>
              </div>
            </div>

            {/* 탭 컨텐츠 */}
            <div className={styles.tabContent}>
              {recordTab === 'record' ? (
                <div className={styles.formSection}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>주증상</label>
                    <input type="text" placeholder="환자의 주증상을 입력하세요" className={styles.formInput} />
                  </div>

                  <div className={styles.formGroup}>
                    <div className={styles.formLabelRow}>
                      <label className={styles.formLabel}>진료 내용</label>
                      <button className={styles.aiButton}>🤖 AI 제안</button>
                    </div>
                    <textarea placeholder="진료 내용을 입력하세요" className={styles.formTextarea} />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>검사 오더</label>
                    <div className={styles.orderCheckboxes}>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" />
                        <span>혈액검사</span>
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" />
                        <span>CT 촬영</span>
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" />
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

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>다음 방문일</label>
                    <input type="date" className={styles.formInput} />
                  </div>

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
                      <div className={styles.prescriptionItem}>
                        <div className={styles.prescriptionInfo}>
                          <div>타이레놀 500mg</div>
                          <div>1일 3회, 7일분</div>
                        </div>
                        <button className={styles.editButton}>수정</button>
                      </div>
                    </div>
                    <button className={styles.addButton}>+ 약물 추가</button>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>복약 지도</label>
                    <textarea placeholder="복약 지도 사항을 입력하세요" className={styles.formTextarea} style={{ minHeight: '100px' }} />
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
