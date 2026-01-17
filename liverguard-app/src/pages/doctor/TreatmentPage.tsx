import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TreatmentPage.module.css';
import { useTreatment } from '../../contexts/TreatmentContext';
import {
  getEncounterDetail,
  getPatientEncounterHistory,
  getPatientLabResults,
  getPatientGenomicData,
  getPatientImagingOrders,
  getPatientQuestionnaires,
  getPatientVitals,
  getDoctorInProgressEncounter,
  createLabOrder,
  createImagingOrder,
  updateEncounter,
  saveMedicalRecord,
  getPatientDetail, // Added
  cancelEncounter
} from '../../api/doctorApi';
import type {
  EncounterDetail,
  GenomicDataItem,
  LabResult,
  ImagingOrder,
  QuestionnaireRecord,
  VitalRecord
} from '../../api/doctorApi';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  days: string;
}

// Components
import PatientInfoHeader from '../../components/doctor/treatment/PatientInfoHeader';
import PatientHistorySection from '../../components/doctor/treatment/PatientHistorySection';
import TreatmentWriteSection from '../../components/doctor/treatment/TreatmentWriteSection';

export default function TreatmentPage() {
  const navigate = useNavigate();
  const { selectedEncounterId, setSelectedEncounterId, selectedPatientId, setSelectedPatientId } = useTreatment();

  // Data State
  const [currentEncounter, setCurrentEncounter] = useState<EncounterDetail | null>(null);
  const [currentPatient, setCurrentPatient] = useState<any>(null); // Patient Detail object

  const [encounterHistory, setEncounterHistory] = useState<EncounterDetail[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [genomicResults, setGenomicResults] = useState<GenomicDataItem[]>([]);
  const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
  const [questionnaireList, setQuestionnaireList] = useState<QuestionnaireRecord[]>([]);
  const [vitalList, setVitalList] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // UI State
  const [rightTab, setRightTab] = useState<'record' | 'prescription'>('record');

  // Form State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosisName, setDiagnosisName] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', days: '' }
  ]);

  const [orderRequests, setOrderRequests] = useState({
    physical: { notes: '' },
    vital: { notes: '' },
    lab: { type: 'BLOOD_LIVER', notes: '' },
    imaging: { modality: 'CT', bodyPart: 'Abdomen', notes: '' },
    genomic: { notes: '' }
  });

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

  // 데이터 초기화
  const clearForm = () => {
    setChiefComplaint('');
    setClinicalNotes('');
    setDiagnosisName('');
    setSelectedOrders([]);
    setOrderRequests({
      physical: { notes: '' },
      vital: { notes: '' },
      lab: { type: 'BLOOD_LIVER', notes: '' },
      imaging: { modality: 'CT', bodyPart: 'Abdomen', notes: '' },
      genomic: { notes: '' }
    });
    setHccDetails({
      ajcc_stage: '', ajcc_t: '', ajcc_n: '', ajcc_m: '', grade: '',
      vascular_invasion: '', ishak_score: '', hepatic_inflammation: '',
      ecog_score: '', tumor_status: ''
    });
  };

  // 진행 중인 encounter 자동 로드 (컴포넌트 마운트 시) - 기존 로직 유지
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
              // patientId will be set when encounter details are loaded
            }
          }
        } catch (error) {
          console.error('진행중인 encounter 로드 실패:', error);
        }
      }
    };
    loadInProgressEncounter();
  }, []);

  // Encounter 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      // 이미 로드된 encounter라면 다시 로드하지 않음 (폼 초기화 방지)
      if (selectedEncounterId && currentEncounter?.encounter_id === selectedEncounterId) {
        return;
      }

      if (selectedEncounterId) {
        await loadEncounterData(selectedEncounterId);
      } else if (selectedPatientId) {
        // Encounter 없이 Patient 만 선택된 경우
        await loadPatientDataOnly(selectedPatientId);
        setCurrentEncounter(null);
        clearForm();
      } else {
        // ID가 모두 없을 때만 초기화
        setCurrentEncounter(null);
        setCurrentPatient(null);
        setEncounterHistory([]);
        setLabResults([]);
        setGenomicResults([]);
        setImagingOrders([]);
        setQuestionnaireList([]);
        setVitalList([]);
        clearForm();
      }
    };
    fetchData();
  }, [selectedEncounterId, selectedPatientId]);

  const loadPatientDataOnly = async (patientId: string) => {
    setLoading(true);
    try {
      const patientData = await getPatientDetail(patientId);
      setCurrentPatient(patientData);

      // 환자의 과거 진료 기록 로드
      const historyResponse = await getPatientEncounterHistory(patientId, 10);
      setEncounterHistory(historyResponse.results);

      // 혈액 검사 결과 로드
      const labResponse = await getPatientLabResults(patientId, 5);
      setLabResults(labResponse.results);

      const genomicResponse = await getPatientGenomicData(patientId);
      setGenomicResults(genomicResponse.results);

      // 영상 검사 결과 로드
      const imagingResponse = await getPatientImagingOrders(patientId, 5);
      setImagingOrders(imagingResponse.results);

      const questionnaireResponse = await getPatientQuestionnaires(patientId, 10);
      setQuestionnaireList(questionnaireResponse.results);

      const vitalResponse = await getPatientVitals(patientId);
      setVitalList(vitalResponse.results);

    } catch (err) {
      console.error("환자 데이터 로드 실패", err);
    } finally {
      setLoading(false);
    }
  }

  const loadEncounterData = async (encounterId: number) => {
    setLoading(true);
    try {
      // 현재 encounter 상세 정보 로드
      const encounterData = await getEncounterDetail(encounterId);
      setCurrentEncounter(encounterData);

      // Patient Info 설정
      setCurrentPatient(encounterData.patient);
      if (encounterData.patient?.patient_id && encounterData.patient.patient_id !== selectedPatientId) {
        setSelectedPatientId(encounterData.patient.patient_id);
      }

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

      const genomicResponse = await getPatientGenomicData(patientId);
      setGenomicResults(genomicResponse.results);

      // 영상 검사 결과 로드
      const imagingResponse = await getPatientImagingOrders(patientId, 5);
      setImagingOrders(imagingResponse.results);

      const questionnaireResponse = await getPatientQuestionnaires(patientId, 10);
      setQuestionnaireList(questionnaireResponse.results);

      const vitalResponse = await getPatientVitals(patientId);
      setVitalList(vitalResponse.results);

      // 현재 encounter의 기존 데이터로 폼 초기화
      setChiefComplaint(encounterData.chief_complaint || '');
      setClinicalNotes(encounterData.clinical_notes || '');
      setDiagnosisName(encounterData.diagnosis_name || '');
      // ... others if needed

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

  const handleAddMedication = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: '', days: '' }]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleTempSave = async () => {
    if (!selectedEncounterId || !currentPatient?.patient_id) {
      alert('환자 정보가 없습니다.');
      return;
    }

    try {
      setLoading(true);
      await saveMedicalRecord({
        encounter_id: selectedEncounterId,
        patient_id: currentPatient.patient_id,
        chief_complaint: chiefComplaint,
        clinical_notes: clinicalNotes,
      });
      alert('임시 저장되었습니다.');
    } catch (error) {
      console.error('진료 기록 임시 저장 실패:', error);
      alert('임시 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleMedicationChange = (index: number, field: string, value: string) => {
    const newMedications = [...medications];
    newMedications[index] = { ...newMedications[index], [field]: value };
    setMedications(newMedications);
  };

  const handleCompleteTreatment = async () => {
    if (!currentEncounter || !selectedEncounterId) return;
    if (!currentPatient?.patient_id) {
      alert('환자 정보가 없습니다.');
      return;
    }

    // 의사 정보 (localStorage or context)
    const doctorInfoStr = localStorage.getItem('doctor');
    const doctorId = doctorInfoStr ? JSON.parse(doctorInfoStr).doctor_id : null;

    if (!doctorId) {
      alert("로그인된 의사 정보를 찾을 수 없습니다.");
      return;
    }

    try {
      setLoading(true);

      // 결정 로직: 오더가 하나라도 있으면 'WAITING_RESULTS', 아니면 'WAITING_PAYMENT' (수납 대기)
      // 의사가 완료 누르면 바로 수납 대기로 넘어감 (COMPLETED는 원무과 수납 후)
      const status = selectedOrders.length > 0 ? 'WAITING_RESULTS' : 'WAITING_PAYMENT';

      // 1. 오더 생성
      const promises = [];

      // 신체 계측
      if (selectedOrders.includes('신체 계측')) {
        promises.push(createLabOrder({
          patient_id: currentPatient.patient_id,
          encounter_id: selectedEncounterId,
          doctor_id: doctorId,
          order_type: 'PHYSICAL',
          order_notes: { notes: orderRequests.physical.notes }
        }));
      }

      // 바이탈
      if (selectedOrders.includes('바이탈 측정')) {
        promises.push(createLabOrder({
          patient_id: currentPatient.patient_id,
          encounter_id: selectedEncounterId,
          doctor_id: doctorId,
          order_type: 'VITAL',
          order_notes: { notes: orderRequests.vital.notes }
        }));
      }

      // 혈액 검사
      if (selectedOrders.includes('혈액검사')) {
        promises.push(createLabOrder({
          patient_id: currentPatient.patient_id,
          encounter_id: selectedEncounterId,
          doctor_id: doctorId,
          order_type: 'BLOOD_LIVER',
          order_notes: {
            detail_type: orderRequests.lab.type,
            notes: orderRequests.lab.notes
          }
        }));
      }

      // 유전체 검사
      if (selectedOrders.includes('유전체 검사')) {
        promises.push(createLabOrder({
          patient_id: currentPatient.patient_id,
          encounter_id: selectedEncounterId,
          doctor_id: doctorId,
          order_type: 'GENOMIC',
          order_notes: { notes: orderRequests.genomic.notes }
        }));
      }

      // 영상 검사 (CT)
      if (selectedOrders.includes('CT 촬영')) {
        promises.push(createImagingOrder({
          patient_id: currentPatient.patient_id,
          encounter_id: selectedEncounterId,
          doctor_id: doctorId,
          modality: orderRequests.imaging.modality,
          body_part: orderRequests.imaging.bodyPart,
          order_notes: orderRequests.imaging.notes
        }));
      }

      await Promise.all(promises);

      await saveMedicalRecord({
        encounter_id: selectedEncounterId,
        patient_id: currentPatient.patient_id,
        chief_complaint: chiefComplaint,
        clinical_notes: clinicalNotes,
        record_status: 'COMPLETED',
      });

      // 2. Encounter 상태 업데이트 (COMPLETED or WAITING_RESULTS)
      await updateEncounter(selectedEncounterId, {
        workflow_state: status, // status 변수 사용
        treatment_plan: clinicalNotes,
        diagnosis: diagnosisName
      });

      if (currentPatient?.patient_id) {
        sessionStorage.removeItem(`ct-result:${currentPatient.patient_id}`);
      }

      alert(status === 'WAITING_RESULTS' ? '오더가 전송되었습니다.' : '진료가 완료되었습니다.');

      // 홈으로 먼저 이동 (Context 업데이트로 인한 리렌더링 문제 방지)
      navigate('/doctor/home');

      // 목록 리프레시 혹은 초기화
      setSelectedEncounterId(null);
      setSelectedPatientId(null);
      setCurrentEncounter(null);
      clearForm();

    } catch (error) {
      console.error('진료 완료 처리 중 오류:', error);
      alert('오더 전송 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTreatment = async () => {
    if (!selectedEncounterId || !confirm('정말 진료를 취소하시겠습니까? 취소된 진료는 복구할 수 없습니다.')) return;

    try {
      setLoading(true);
      await cancelEncounter(selectedEncounterId);
      alert('진료가 취소되었습니다.');

      // 홈으로 먼저 이동
      navigate('/doctor/home');

      // 목록 리프레시 및 초기화
      setSelectedEncounterId(null);
      setSelectedPatientId(null);
      setCurrentEncounter(null);
      clearForm();

    } catch (error) {
      console.error('진료 취소 실패:', error);
      alert('진료 취소 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className={styles.treatmentContainer}>
      <PatientInfoHeader
        patient={currentPatient}
        labResults={labResults}
        imagingOrders={imagingOrders}
      />

      <div className={styles.mainLayout}>
      <PatientHistorySection
        encounterHistory={encounterHistory}
        questionnaireList={questionnaireList}
        vitalList={vitalList}
        labResults={labResults}
        genomicData={genomicResults}
      />

        <TreatmentWriteSection
          rightTab={rightTab}
          setRightTab={setRightTab}
          chiefComplaint={chiefComplaint}
          setChiefComplaint={setChiefComplaint}
          clinicalNotes={clinicalNotes}
          setClinicalNotes={setClinicalNotes}
          diagnosisName={diagnosisName}
          setDiagnosisName={setDiagnosisName}
          selectedOrders={selectedOrders}
          handleOrderToggle={handleOrderToggle}
          orderRequests={orderRequests}
          setOrderRequests={setOrderRequests}
          hccDetails={hccDetails}
          setHccDetails={setHccDetails}
          onComplete={handleCompleteTreatment}
          onTempSave={handleTempSave}
          disabled={!selectedEncounterId || currentEncounter?.encounter_status === 'COMPLETED'}
          medications={medications}
          onAddMedication={handleAddMedication}
          onRemoveMedication={handleRemoveMedication}
          onMedicationChange={handleMedicationChange}
          onCancel={handleCancelTreatment}
        />
      </div>
    </div>
  );
}
