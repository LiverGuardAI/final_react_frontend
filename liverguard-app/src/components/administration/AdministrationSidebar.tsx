import { useMemo, useState } from 'react';
import { useAdministrationData } from '../../contexts/AdministrationContext';
import styles from '../../pages/administration/Dashboard.module.css';
import PatientActionModal from './PatientActionModal';
import QuestionnaireModal, { type QuestionnaireData } from './QuestionnaireModal';
import PatientDetailModal from './PatientDetailModal';
import { updateEncounter, createQuestionnaire, cancelEncounter } from '../../api/receptionApi';
import { getPatientDetail, updatePatient, type PatientUpdateData } from '../../api/hospitalOpsApi';

interface AdministrationSidebarProps {
    staffName?: string;
    departmentName?: string;
}

const normalizeGenderLabel = (gender?: string) => {
    if (!gender) return 'N/A';
    if (gender === 'M' || gender === '남') return '남';
    if (gender === 'F' || gender === '여') return '여';
    return gender;
};

const getGenderSymbol = (gender?: string) => {
    if (gender === 'M' || gender === '남') return '♂';
    if (gender === 'F' || gender === '여') return '♀';
    return '-';
};

export default function AdministrationSidebar({
    staffName = '원무과',
    departmentName = '부서'
}: AdministrationSidebarProps) {
    const { waitingQueueData, fetchWaitingQueue, fetchDashboardStats } = useAdministrationData();
    const [activeTab, setActiveTab] = useState<'clinic' | 'imaging'>('clinic');

    // Modals for Sidebar Actions
    const [isPatientActionModalOpen, setIsPatientActionModalOpen] = useState(false);
    const [selectedWaitingPatient, setSelectedWaitingPatient] = useState<any>(null);

    // Questionnaire Modal State (Triggered from Action Modal)
    const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
    const [questionnairePatient, setQuestionnairePatient] = useState<any>(null);
    const [lastEncounterId, setLastEncounterId] = useState<number | null>(null);
    const [questionnaireInitialData, setQuestionnaireInitialData] = useState<QuestionnaireData | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDetailEditing, setIsDetailEditing] = useState(false);
    const [detailPatient, setDetailPatient] = useState<any>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    // Utility: unique patient list by latest encounter
    const getUniquePatients = (encounters: any[]) => {
        return encounters.reduce((acc: any[], current: any) => {
            const existing = acc.find((item: any) => item.patient_id === current.patient_id);
            if (!existing || new Date(current.created_at) > new Date(existing.created_at)) {
                return [...acc.filter((item: any) => item.patient_id !== current.patient_id), current];
            }
            return acc;
        }, []);
    };

    const uniqueClinicPatients = useMemo(() => {
        if (!waitingQueueData?.queue) return { inClinic: [], waiting: [], all: [] };

        const clinicCandidates = waitingQueueData.queue.filter((item: any) =>
            ['IN_CLINIC', 'WAITING_CLINIC'].includes(item.workflow_state)
        );

        const uniqueAll = getUniquePatients(clinicCandidates);
        const uniqueInClinic = uniqueAll.filter((item: any) => item.workflow_state === 'IN_CLINIC');
        const uniqueWaiting = uniqueAll.filter((item: any) => item.workflow_state === 'WAITING_CLINIC');

        return {
            inClinic: uniqueInClinic,
            waiting: uniqueWaiting,
            all: uniqueAll
        };
    }, [waitingQueueData]);

    const uniqueResultPatients = useMemo(() => {
        if (!waitingQueueData?.queue) return [];
        const resultPatients = waitingQueueData.queue.filter((item: any) =>
            item.workflow_state === 'WAITING_RESULTS'
        );
        return getUniquePatients(resultPatients);
    }, [waitingQueueData]);

    const uniqueClinicPatientCount = uniqueClinicPatients.all.length;
    const uniqueResultPatientCount = uniqueResultPatients.length;

    const getResultWaitingLabel = (queueItem: any) => {
        const orders = Array.isArray(queueItem?.orders_status)
            ? queueItem.orders_status
            : Array.isArray(queueItem?.orders)
                ? queueItem.orders
                : [];

        const labels: string[] = [];
        orders.forEach((order: any) => {
            const name =
                order?.name ||
                order?.order_name ||
                order?.orderName ||
                order?.type_display ||
                order?.type;

            if (name && !labels.includes(name)) {
                labels.push(name);
            }
        });

        return labels.length > 0 ? labels.join(' / ') : undefined;
    };

    // --- Handlers ---

    const handlePatientClick = (queueItem: any) => {
        const resultWaitingLabel = queueItem.workflow_state === 'WAITING_RESULTS'
            ? queueItem.result_waiting_label || getResultWaitingLabel(queueItem)
            : undefined;
        setSelectedWaitingPatient({
            ...queueItem,
            resultWaitingLabel,
            resultWaitingStartedAt: queueItem.workflow_state === 'WAITING_RESULTS'
                ? queueItem.result_waiting_started_at || queueItem.state_entered_at || queueItem.updated_at || queueItem.created_at
                : undefined,
            waitingDurationSeconds: queueItem.waiting_duration_seconds
        });
        setIsPatientActionModalOpen(true);
    };

    const handleOpenQuestionnaireFromAction = () => {
        if (!selectedWaitingPatient) return;

        setLastEncounterId(selectedWaitingPatient.encounter_id);
        setQuestionnairePatient({
            id: selectedWaitingPatient.patient || selectedWaitingPatient.patient_id,
            name: selectedWaitingPatient.patient_name || '이름 없음',
            birthDate: selectedWaitingPatient.date_of_birth || 'N/A',
            age: selectedWaitingPatient.age || 0,
            gender: normalizeGenderLabel(selectedWaitingPatient.gender),
            phone: selectedWaitingPatient.phone || 'N/A',
        });

        if (selectedWaitingPatient.questionnaire_data) {
            setQuestionnaireInitialData(selectedWaitingPatient.questionnaire_data);
        } else {
            setQuestionnaireInitialData(null);
        }

        setIsQuestionnaireModalOpen(true);
    };

    const handleQuestionnaireSubmit = async (data: QuestionnaireData) => {
        try {
            if (lastEncounterId) {
                await updateEncounter(lastEncounterId, {
                    questionnaire_data: data,
                    questionnaire_status: 'COMPLETED'
                });
                alert('문진표가 제출되었습니다.');
            } else {
                await createQuestionnaire(data);
                alert('문진표가 제출되었습니다.');
            }

            Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);

            setIsQuestionnaireModalOpen(false);
            setQuestionnairePatient(null);
            setLastEncounterId(null);
        } catch (error: any) {
            console.error('문진표 제출 실패:', error);
            alert('문진표 제출 중 오류가 발생했습니다.');
        }
    };

    const handleQuestionnaireDelete = async () => {
        try {
            if (lastEncounterId) {
                await updateEncounter(lastEncounterId, {
                    questionnaire_data: null,
                    questionnaire_status: 'NOT_STARTED'
                });
                alert('문진표가 삭제되었습니다.');
                Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);
                setIsQuestionnaireModalOpen(false);
                setQuestionnairePatient(null);
                setLastEncounterId(null);
            }
        } catch (error) {
            console.error('문진표 삭제 실패', error);
        }
    };

    const handleCancelWaiting = async (encounterId: number, patientName: string, workflowState: string) => {
        if (workflowState === 'IN_CLINIC') {
            alert('진료 중인 환자는 취소할 수 없습니다.');
            return;
        }
        if (!window.confirm(`${patientName} 환자를 대기열에서 취소하시겠습니까?`)) return;

        try {
            await cancelEncounter(encounterId);
            alert('대기열이 취소되었습니다.');
            Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);
            setIsPatientActionModalOpen(false);
        } catch (error: any) {
            console.error('대기열 취소 실패:', error);
            alert('대기열 취소 중 오류가 발생했습니다.');
        }
    };

    const handleRequeueToClinic = async (encounterId: number, patientName: string) => {
        if (!window.confirm(`${patientName} 환자를 진료 대기로 변경하시겠습니까?`)) return;
        try {
            await updateEncounter(encounterId, {
                workflow_state: 'WAITING_CLINIC',
                status: 'IN_PROGRESS'
            });
            alert('진료 대기 상태로 변경되었습니다.');
            Promise.all([fetchWaitingQueue(), fetchDashboardStats()]);
            setIsPatientActionModalOpen(false);
        } catch (error) {
            console.error('진료 대기 전송 실패', error);
            alert('작업 처리에 실패했습니다.');
        }
    };

    const handleViewDetails = async () => {
        if (!selectedWaitingPatient) return;
        const patientId = String(selectedWaitingPatient.patient || selectedWaitingPatient.patient_id);
        setDetailPatient({
            id: patientId,
            name: selectedWaitingPatient.patient_name || '이름 없음',
            birthDate: selectedWaitingPatient.date_of_birth || 'N/A',
            gender: normalizeGenderLabel(selectedWaitingPatient.gender),
            phone: selectedWaitingPatient.phone || 'N/A',
        });
        setIsDetailEditing(false);
        setIsDetailModalOpen(true);
        setIsDetailLoading(true);
        try {
            const detailData = await getPatientDetail(patientId);
            setDetailPatient({
                id: patientId,
                name: detailData.name || selectedWaitingPatient.patient_name || '이름 없음',
                birthDate: detailData.birthDate || detailData.date_of_birth || selectedWaitingPatient.date_of_birth || 'N/A',
                gender: normalizeGenderLabel(detailData.gender || selectedWaitingPatient.gender),
                phone: detailData.phone || selectedWaitingPatient.phone || 'N/A',
            });
        } catch (error) {
            console.error('환자 상세 정보 조회 실패:', error);
            alert('환자 상세 정보를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setDetailPatient(null);
        setIsDetailEditing(false);
        setIsDetailLoading(false);
    };

    const handleEditDetail = () => setIsDetailEditing(true);

    const handleCancelDetailEdit = () => setIsDetailEditing(false);

    const handleUpdateDetailPatient = async (data: any) => {
        if (!detailPatient) return;
        try {
            const updateData: PatientUpdateData = {
                name: data.name,
                date_of_birth: data.date_of_birth,
                gender: data.gender as 'M' | 'F',
                phone: data.phone || undefined,
            };
            await updatePatient(detailPatient.id.toString(), updateData);
            setDetailPatient({
                ...detailPatient,
                name: data.name,
                birthDate: data.date_of_birth,
                gender: normalizeGenderLabel(data.gender),
                phone: data.phone || 'N/A',
            });
            setIsDetailEditing(false);
            alert('환자 정보가 저장되었습니다.');
        } catch (error) {
            console.error('환자 정보 저장 실패:', error);
            alert('환자 정보 저장 중 오류가 발생했습니다.');
        }
    };

    return (
        <>
            <div className={styles.sidebar}>
                <div className={styles.sidebarContent}>
                    <div className={styles.profileSection}>
                        <div className={styles.profileImage}>
                            <svg className={styles.profileIcon} viewBox="0 0 64 64" aria-hidden="true">
                                <rect x="10" y="14" width="44" height="40" rx="8" fill="#7AA6D6" />
                                <rect x="16" y="20" width="8" height="8" rx="2" fill="#E6F0FA" />
                                <rect x="40" y="20" width="8" height="8" rx="2" fill="#E6F0FA" />
                                <rect x="16" y="34" width="8" height="8" rx="2" fill="#E6F0FA" />
                                <rect x="40" y="34" width="8" height="8" rx="2" fill="#E6F0FA" />
                                <rect x="29" y="24" width="6" height="16" rx="2" fill="#FFFFFF" />
                                <rect x="24" y="29" width="16" height="6" rx="2" fill="#FFFFFF" />
                            </svg>
                        </div>
                        <div className={styles.profileInfo}>
                            <div className={styles.profileName}>{staffName}</div>
                            <div className={styles.departmentTag}>{departmentName}</div>
                            <div className={styles.statusInfo}>
                                상태: <span className={styles.statusBadge}> 근무중 </span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.waitingSection}>
                        <div className={styles.waitingSectionTitle}>총 환자 현황</div>

                        <div className={styles.patientListTabs}>
                            <button
                                className={`${styles.patientListTab} ${activeTab === 'clinic' ? styles.active : ''}`}
                                onClick={() => setActiveTab('clinic')}
                            >
                                진료 대기({uniqueClinicPatientCount}명)
                            </button>
                            <button
                                className={`${styles.patientListTab} ${activeTab === 'imaging' ? styles.active : ''}`}
                                onClick={() => setActiveTab('imaging')}
                            >
                                결과 대기({uniqueResultPatientCount}명)
                            </button>
                        </div>

                        <div className={styles.patientListContent}>
                            {!waitingQueueData || !waitingQueueData.queue || waitingQueueData.queue.length === 0 ? (
                                <div className={styles.emptyState}>대기 중인 환자가 없습니다.</div>
                            ) : (
                                <>
                                    {activeTab === 'clinic' ? (
                                        <>
                                            {uniqueClinicPatients.inClinic.map((queueItem: any) => (
                                                <PatientCard
                                                    key={`in-clinic-${queueItem.encounter_id}`}
                                                    queueItem={queueItem}
                                                    onClick={handlePatientClick}
                                                    type="IN_CLINIC"
                                                />
                                            ))}
                                            {uniqueClinicPatients.waiting.map((queueItem: any) => (
                                                <PatientCard
                                                    key={`waiting-${queueItem.encounter_id}`}
                                                    queueItem={queueItem}
                                                    onClick={handlePatientClick}
                                                    type="WAITING"
                                                />
                                            ))}
                                            {uniqueClinicPatients.all.length === 0 && (
                                                <div className={styles.emptyState}>진료 대기 환자가 없습니다.</div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {uniqueResultPatients.map((queueItem: any) => (
                                                <PatientCard
                                                    key={`result-${queueItem.encounter_id}`}
                                                    queueItem={queueItem}
                                                    onClick={handlePatientClick}
                                                    type="WAITING"
                                                />
                                            ))}
                                            {uniqueResultPatients.length === 0 && (
                                                <div className={styles.emptyState}>결과 대기 환자가 없습니다.</div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedWaitingPatient && (
                <PatientActionModal
                    isOpen={isPatientActionModalOpen}
                    onClose={() => setIsPatientActionModalOpen(false)}
                    patient={{
                        id: selectedWaitingPatient.patient || selectedWaitingPatient.patient_id,
                        name: selectedWaitingPatient.patient_name || '이름 없음',
                        gender: normalizeGenderLabel(selectedWaitingPatient.gender),
                        birthDate: selectedWaitingPatient.date_of_birth,
                        phone: selectedWaitingPatient.phone,
                        registrationTime: selectedWaitingPatient.created_at,
                        encounterId: selectedWaitingPatient.encounter_id,
                        encounter_status: selectedWaitingPatient.workflow_state,
                        questionnaireStatus: selectedWaitingPatient.questionnaire_status || 'NOT_STARTED',
                        resultWaitingLabel: selectedWaitingPatient.resultWaitingLabel || (
                            selectedWaitingPatient.workflow_state === 'WAITING_RESULTS'
                                ? getResultWaitingLabel(selectedWaitingPatient)
                                : undefined
                        ),
                        resultWaitingStartedAt: selectedWaitingPatient.resultWaitingStartedAt,
                        waitingDurationSeconds: selectedWaitingPatient.waitingDurationSeconds
                    }}
                    onQuestionnaireAction={handleOpenQuestionnaireFromAction}
                    onViewDetails={handleViewDetails}
                />
            )}

            {isDetailModalOpen && detailPatient && (
                <PatientDetailModal
                    isOpen={isDetailModalOpen}
                    patient={detailPatient}
                    isEditing={isDetailEditing}
                    onClose={handleCloseDetailModal}
                    onEdit={handleEditDetail}
                    onCancelEdit={handleCancelDetailEdit}
                    onSave={handleUpdateDetailPatient}
                />
            )}

            {questionnairePatient && (
                <QuestionnaireModal
                    isOpen={isQuestionnaireModalOpen}
                    onClose={() => setIsQuestionnaireModalOpen(false)}
                    patient={questionnairePatient}
                    onSubmit={handleQuestionnaireSubmit}
                    initialData={questionnaireInitialData}
                    onDelete={handleQuestionnaireDelete}
                />
            )}
        </>
    );
}

function PatientCard({ queueItem, onClick, type }: { queueItem: any, onClick: (item: any) => void, type: string }) {
    const questionnaireStatus = queueItem.questionnaire_status || 'NOT_STARTED';
    let borderLeft = '4px solid var(--sky-200)';

    if (type === 'IN_CLINIC') {
        borderLeft = '4px solid var(--sky-700)';
    } else if (type === 'WAITING') {
        if (queueItem.workflow_state === 'WAITING_RESULTS') {
            borderLeft = '4px solid var(--sky-500)';
        }
    } else if (type === 'IMAGING') {
        const isWaitingPayment = queueItem.workflow_state === 'WAITING_PAYMENT';
        const isInImaging = queueItem.workflow_state === 'IN_IMAGING';
        borderLeft = isWaitingPayment ? '4px solid var(--sky-700)' : isInImaging ? '4px solid var(--sky-600)' : '4px solid var(--sky-400)';
    }

    return (
        <div
            className={`${styles.patientCard} ${type === 'IN_CLINIC' ? styles.inProgress : ''}`}
            onClick={() => onClick(queueItem)}
            style={{ cursor: 'pointer', borderLeft }}
        >
            <div className={styles.patientHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.patientName}>{queueItem.patient_name || '이름 없음'}</span>
                    {queueItem.doctor_name && (
                        <span className={styles.patientDetails} style={{ marginBottom: 0 }}>
                            {`담당: ${queueItem.doctor_name}`}
                        </span>
                    )}
                </div>
                <span className={styles.genderIcon}>{getGenderSymbol(queueItem.gender)}</span>
            </div>
            <div className={styles.patientDetails}>
                {queueItem.date_of_birth || 'N/A'} | {queueItem.age || 0}세 | {normalizeGenderLabel(queueItem.gender)}
            </div>
            <div className={styles.patientActions}>
                <span style={{
                    background: questionnaireStatus === 'COMPLETED' ? '#c4f6ffff' :
                        questionnaireStatus === 'IN_PROGRESS' ? '#E3F2FD' : '#F5F5F5',
                    color: questionnaireStatus === 'COMPLETED' ? '#1565C0' :
                        questionnaireStatus === 'IN_PROGRESS' ? '#1565C0' : '#757575',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    marginRight: '6px',
                    whiteSpace: 'nowrap'
                }}>
                    {questionnaireStatus === 'COMPLETED' ? '작성완료' :
                        questionnaireStatus === 'IN_PROGRESS' ? '작성중' : '미작성'}
                </span>

                {type === 'IN_CLINIC' && (
                    <span className={styles.workflowBadge} style={{
                        background: 'var(--sky-400)',
                        color: 'var(--sky-text-strong)',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        진료중
                    </span>
                )}
                {queueItem.workflow_state === 'WAITING_RESULTS' && (
                    <span className={styles.workflowBadge} style={{
                        background: 'var(--sky-300)',
                        color: 'var(--sky-text)',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        결과대기
                    </span>
                )}
                {queueItem.workflow_state === 'WAITING_CLINIC' && type !== 'IN_CLINIC' && (
                    <span className={styles.workflowBadge} style={{
                        background: 'var(--sky-300)',
                        color: 'var(--sky-text)',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        진료대기
                    </span>
                )}

                {type === 'IMAGING' && (
                    <span className={styles.workflowBadge} style={{
                        background: queueItem.workflow_state === 'WAITING_PAYMENT' ? 'var(--sky-300)' : queueItem.workflow_state === 'IN_IMAGING' ? 'var(--sky-400)' : 'var(--sky-200)',
                        color: queueItem.workflow_state === 'WAITING_PAYMENT' ? 'var(--sky-text)' : 'var(--sky-text-strong)',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        {queueItem.workflow_state === 'WAITING_PAYMENT' ? '수납대기' : queueItem.workflow_state === 'IN_IMAGING' ? '촬영중' : '촬영대기'}
                    </span>
                )}
            </div>
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginTop: '5px' }}>
                {queueItem.created_at ? new Date(queueItem.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </div>
        </div>
    );
}
