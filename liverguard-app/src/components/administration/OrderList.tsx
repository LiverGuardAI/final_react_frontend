import React, { useState, useEffect, useMemo } from 'react';
import { getPendingOrders, getInProgressOrders, confirmOrder, assignDoctorToImagingOrder, updateEncounter, type PendingOrder } from '../../api/hospitalOpsApi';
import { useAdministrationData } from '../../contexts/AdministrationContext';
import type { Doctor } from '../../hooks/useDoctors';
import styles from './OrderList.module.css';

interface OrderListProps {
    refreshTrigger?: number;
    onOpenVitalCheckModal?: (order: PendingOrder, isLastOrder: boolean, hasCTOrder: boolean) => void;
    showInProgressOnly?: boolean;
}

interface GroupedOrders {
    patient_id: string;
    patient_name: string;
    orders: PendingOrder[];
}

export default function OrderList({ refreshTrigger, onOpenVitalCheckModal, showInProgressOnly = false }: OrderListProps) {
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDoctorSelect, setShowDoctorSelect] = useState<string | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<GroupedOrders | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const { doctors, radiologists } = useAdministrationData();

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = showInProgressOnly ? await getInProgressOrders() : await getPendingOrders();
            setOrders(data.results);
            setCurrentPage(1); // 데이터 로드 시 첫 페이지로 리셋
        } catch (err) {
            console.error('오더 목록 조회 실패:', err);
            setError('오더 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 환자별로 오더 그룹화
    const groupedOrders = useMemo(() => {
        const groups: { [key: string]: GroupedOrders } = {};

        orders.forEach(order => {
            if (!groups[order.patient_id]) {
                groups[order.patient_id] = {
                    patient_id: order.patient_id,
                    patient_name: order.patient_name,
                    orders: []
                };
            }
            groups[order.patient_id].orders.push(order);
        });

        return Object.values(groups);
    }, [orders]);

    // 유전체/혈액검사 오더: 개별 접수 후 처리
    // 유전체/혈액검사는 당일 결과가 안 나오므로, CT 없이 마지막 오더면 무조건 수납 대기
    const handleGenomicOrBloodOrder = async (orderId: string, type: 'LAB' | 'IMAGING', encounterId?: number) => {
        if (!window.confirm('이 외부 검사 요청을 접수하시겠습니까?')) {
            return;
        }

        try {
            await confirmOrder(orderId, type, 'CONFIRM');

            // 현재 상태에서 마지막 오더인지 확인 (state 업데이트 전이므로 length === 1 체크)
            const isLastOrder = selectedPatient && selectedPatient.orders.length === 1;
            // CT 오더가 있는지 확인
            const hasCTOrder = selectedPatient?.orders.some(o => o.type === 'IMAGING');

            if (isLastOrder && encounterId && !hasCTOrder) {
                // CT 오더가 없고 마지막 오더 → 유전체/혈액검사는 무조건 수납 대기
                await updateEncounter(encounterId, { workflow_state: 'WAITING_PAYMENT' });
                alert('접수되었습니다. 환자가 수납 대기 상태로 이동되었습니다.');
                closeModal();
                fetchOrders();
            } else {
                alert('접수되었습니다.');
                await fetchOrders();

                // selectedPatient 상태 업데이트
                if (selectedPatient) {
                    const updatedOrders = selectedPatient.orders.filter(o => o.id !== orderId);
                    if (updatedOrders.length === 0) {
                        closeModal();
                    } else {
                        setSelectedPatient({
                            ...selectedPatient,
                            orders: updatedOrders
                        });
                    }
                }
            }
        } catch (err) {
            console.error('오더 처리 실패:', err);
            alert('오더 처리 중 오류가 발생했습니다.');
        }
    };

    // 바이탈/신체계측 검사: 모달 열기
    const handleVitalOrPhysicalOrder = (order: PendingOrder) => {
        // 남은 오더가 1개인지 확인
        const patientGroup = groupedOrders.find(g => g.patient_id === order.patient_id);
        const isLastOrder = patientGroup ? patientGroup.orders.length === 1 : true;
        // CT 오더가 있는지 확인
        const hasCTOrder = patientGroup ? patientGroup.orders.some(o => o.type === 'IMAGING') : false;

        if (onOpenVitalCheckModal) {
            onOpenVitalCheckModal(order, isLastOrder, hasCTOrder);
        } else {
            alert('검사 입력 기능이 준비 중입니다.');
        }
    };

    // 영상의학과 오더: 의사 배정 후 대기열에 추가
    // CT 오더는 백엔드에서 자동으로 WAITING_IMAGING으로 전환하므로 프론트에서 상태 변경하지 않음
    const handleImagingOrder = async (orderId: string) => {
        if (!selectedDoctor) {
            alert('촬영을 담당할 영상의학과 의사를 선택해주세요.');
            return;
        }

        if (!window.confirm('선택한 의사에게 촬영을 배정하시겠습니까?')) {
            return;
        }

        try {
            await assignDoctorToImagingOrder(orderId, selectedDoctor);
            alert('촬영 오더가 배정되었습니다. 환자가 CT 대기열로 이동합니다.');

            setShowDoctorSelect(null);
            setSelectedDoctor(null);
            await fetchOrders();

            // 모달에서 해당 오더 제거
            if (selectedPatient) {
                const updatedOrders = selectedPatient.orders.filter(o => o.id !== orderId);
                if (updatedOrders.length === 0) {
                    closeModal();
                } else {
                    setSelectedPatient({
                        ...selectedPatient,
                        orders: updatedOrders
                    });
                }
            }
        } catch (err) {
            console.error('영상의학과 오더 배정 실패:', err);
            alert('오더 배정 중 오류가 발생했습니다.');
        }
    };

    // 일반 접수 (기본)
    const handleConfirm = async (orderId: string, type: 'LAB' | 'IMAGING', action: 'CONFIRM' | 'CONFIRM_AND_DISCHARGE') => {
        if (!window.confirm(action === 'CONFIRM_AND_DISCHARGE' ? '오더를 접수하고 환자를 수납(귀가) 단계로 이동시키겠습니까?' : '오더를 접수하시겠습니까?')) {
            return;
        }

        try {
            await confirmOrder(orderId, type, action);
            alert('처리되었습니다.');
            fetchOrders();
        } catch (err) {
            console.error('오더 처리 실패:', err);
            alert('오더 처리 중 오류가 발생했습니다.');
        }
    };

    const openModal = (group: GroupedOrders) => {
        setSelectedPatient(group);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setSelectedPatient(null);
        setIsModalOpen(false);
        setShowDoctorSelect(null);
        setSelectedDoctor(null);
    };

    useEffect(() => {
        fetchOrders();
    }, [refreshTrigger]);



    // 영상의학과 의사 필터링 (Deprecated)
    // const radiologyDoctors = doctors.filter((d: Doctor) => d.department?.dept_name === '영상의학과');

    const totalPages = Math.ceil(groupedOrders.length / itemsPerPage);
    const currentOrders = groupedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <>
            <div className={styles.container}>
                <div className={styles.listGroup}>
                    {/* 리스트 헤더 추가 */}
                    <div className={styles.listHeader}>
                        <div className={styles.colStatus}>상태</div>
                        <div className={styles.colPatient}>환자 정보</div>
                        <div className={styles.colOrder}>오더 내용</div>
                        <div className={styles.colDoctor}>요청 의사</div>
                        <div className={styles.colTime}>요청 시간</div>
                    </div>

                    {isLoading && orders.length === 0 ? (
                        <div className={styles.loading}>정보를 불러오는 중...</div>
                    ) : error ? (
                        <div className={styles.error}>{error}</div>
                    ) : orders.length === 0 ? (
                        <div className={styles.emptyState}>
                            {showInProgressOnly ? '진행 중인 검사가 없습니다.' : '대기 중인 추가 진료(오더)가 없습니다.'}
                        </div>
                    ) : (
                        currentOrders.map((group) => {
                            const orderNames = group.orders.map(o => o.order_name).join(', ');
                            const firstOrder = group.orders[0];

                            return (
                                <div
                                    key={group.patient_id}
                                    className={styles.listItem}
                                    onClick={() => openModal(group)}
                                >
                                    {/* 상태 배지 */}
                                    <div className={styles.colStatus}>
                                        <span className={styles.statusBadgeItem}>
                                            오더 {group.orders.length}건
                                        </span>
                                    </div>

                                    {/* 환자 이름 */}
                                    <div className={styles.colPatient}>
                                        <span className={styles.patientNameText}>
                                            {group.patient_name}
                                        </span>
                                        <span className={styles.patientIdText}>
                                            ({group.patient_id})
                                        </span>
                                    </div>

                                    {/* 검사명 */}
                                    <div className={`${styles.colOrder} ${styles.orderNameText}`}>
                                        {orderNames}
                                    </div>

                                    {/* 요청 의사 */}
                                    <div className={`${styles.colDoctor} ${styles.doctorNameText}`}>
                                        {firstOrder.doctor_name}
                                    </div>

                                    {/* 시간 */}
                                    <div className={`${styles.colTime} ${styles.timeText}`}>
                                        {new Date(firstOrder.created_at).toLocaleString('ko-KR', {
                                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {/* 페이지네이션 버튼 */}
                <div className={styles.pagination}>
                    <button
                        className={styles.pageButton}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        이전
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                        <button
                            key={pageNumber}
                            className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ''}`}
                            onClick={() => setCurrentPage(pageNumber)}
                        >
                            {pageNumber}
                        </button>
                    ))}
                    <button
                        className={styles.pageButton}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        다음
                    </button>
                </div>
            </div>

            {/* 오더 상세 팝업 모달 */}
            {isModalOpen && selectedPatient && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '30px',
                        width: '700px',
                        maxWidth: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '25px',
                            borderBottom: '2px solid #FFE082',
                            paddingBottom: '15px'
                        }}>
                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#333' }}>
                                오더 처리 - {selectedPatient.patient_name} ({selectedPatient.patient_id})
                            </h2>
                            <button
                                onClick={closeModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '28px',
                                    cursor: 'pointer',
                                    color: '#999',
                                    lineHeight: 1,
                                    padding: 0
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {selectedPatient.orders.map((order) => {
                                const isGenomicOrBlood = order.type === 'LAB' && (order.order_type === 'GENOMIC' || order.order_type === 'BLOOD_LIVER');
                                const isVitalOrPhysical = order.type === 'LAB' && (order.order_type === 'VITAL' || order.order_type === 'PHYSICAL');
                                const isImaging = order.type === 'IMAGING';

                                return (
                                    <div
                                        key={order.id}
                                        style={{
                                            padding: '16px',
                                            backgroundColor: '#F8F9FA',
                                            borderRadius: '8px',
                                            border: '1px solid #E0E0E0'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{
                                                        fontSize: '12px',
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        backgroundColor: order.type === 'LAB' ? '#E3F2FD' : '#F3E5F5',
                                                        color: order.type === 'LAB' ? '#1976D2' : '#7B1FA2',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {order.type_display}
                                                    </span>
                                                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                                                        {order.order_name}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                                                    - 요청 의사: {order.doctor_name} ({order.department_name})
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#666' }}>
                                                    - 요청 시간: {new Date(order.created_at).toLocaleString('ko-KR')}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {isGenomicOrBlood ? (
                                                <button
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: '#B3E5FC',
                                                        color: '#0277BD',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '13px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onClick={() => handleGenomicOrBloodOrder(order.id, order.type as 'LAB' | 'IMAGING', order.encounter_id)}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#81D4FA'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#B3E5FC'}
                                                >
                                                    외부 요청
                                                </button>
                                            ) : isVitalOrPhysical ? (
                                                <button
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: '#B3E5FC',
                                                        color: '#0277BD',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '13px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onClick={() => handleVitalOrPhysicalOrder(order)}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#81D4FA'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#B3E5FC'}
                                                >
                                                    검사 데이터 입력
                                                </button>
                                            ) : isImaging ? (
                                                <>
                                                    {showDoctorSelect === order.id ? (
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                                            <select
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '8px 12px',
                                                                    border: '1px solid #DDD',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px'
                                                                }}
                                                                value={selectedDoctor || ''}
                                                                onChange={(e) => setSelectedDoctor(Number(e.target.value))}
                                                            >
                                                                <option value="">의사 선택</option>
                                                                {radiologists.map((doc: any) => (
                                                                    <option key={doc.radiologic_id} value={doc.radiologic_id}>
                                                                        {doc.name} ({doc.department?.dept_name || '영상의학과'})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    backgroundColor: '#B3E5FC',
                                                                    color: '#0277BD',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px',
                                                                    fontWeight: 'bold',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => handleImagingOrder(order.id)}
                                                            >
                                                                배정
                                                            </button>
                                                            <button
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    backgroundColor: '#FFCDD2',
                                                                    color: '#C62828',
                                                                    border: 'none',
                                                                    borderRadius: '6px',
                                                                    fontSize: '13px',
                                                                    fontWeight: 'bold',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => {
                                                                    setShowDoctorSelect(null);
                                                                    setSelectedDoctor(null);
                                                                }}
                                                            >
                                                                취소
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            style={{
                                                                padding: '8px 16px',
                                                                backgroundColor: '#B3E5FC',
                                                                color: '#0277BD',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                fontSize: '13px',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onClick={() => setShowDoctorSelect(order.id)}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#81D4FA'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#B3E5FC'}
                                                        >
                                                            영상의학과 의사 배정
                                                        </button>
                                                    )}
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={closeModal}
                                style={{
                                    padding: '10px 24px',
                                    backgroundColor: '#E0E0E0',
                                    color: '#666',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#BDBDBD'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E0E0E0'}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
