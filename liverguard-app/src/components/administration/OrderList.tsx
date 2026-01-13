import React, { useState, useEffect, useMemo } from 'react';
import { getPendingOrders, getInProgressOrders, confirmOrder, assignDoctorToImagingOrder, updateEncounter, type PendingOrder } from '../../api/administrationApi';
import { useAdministrationData } from '../../contexts/AdministrationContext';
import type { Doctor } from '../../hooks/useDoctors';
import styles from './OrderList.module.css';

interface OrderListProps {
    refreshTrigger?: number;
    onOpenVitalCheckModal?: (order: PendingOrder, isLastOrder: boolean) => void;
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

    const { doctors } = useAdministrationData();

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

    // 유전체/혈액검사 오더: 개별 접수 후 마지막 오더일 때 분기 처리
    const handleGenomicOrBloodOrder = async (orderId: string, type: 'LAB' | 'IMAGING', encounterId?: number) => {
        if (!window.confirm('이 외부 검사 요청을 접수하시겠습니까?')) {
            return;
        }

        try {
            await confirmOrder(orderId, type, 'CONFIRM');

            // 현재 상태에서 마지막 오더인지 확인 (state 업데이트 전이므로 length === 1 체크)
            const isLastOrder = selectedPatient && selectedPatient.orders.length === 1;

            if (isLastOrder && encounterId) {
                alert('접수되었습니다.');

                // 수납 대기 여부 확인
                if (window.confirm('모든 오더가 처리되었습니다.\n환자를 수납(귀가) 대기로 이동시키겠습니까?')) {
                    await updateEncounter(encounterId, { workflow_state: 'WAITING_PAYMENT' });
                    alert('환자가 수납 대기 상태로 이동되었습니다.');
                    closeModal();
                }
                // 진료 대기 여부 확인
                else if (window.confirm('그럼 환자를 진료실 대기(추가 진료)로 이동시키겠습니까?')) {
                    await updateEncounter(encounterId, { workflow_state: 'WAITING_CLINIC' });
                    alert('환자가 진료 대기 상태로 이동되었습니다.');
                    closeModal();
                }
                // 그냥 닫기
                else {
                    closeModal();
                }

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

        if (onOpenVitalCheckModal) {
            onOpenVitalCheckModal(order, isLastOrder);
        } else {
            alert('검사 입력 기능이 준비 중입니다.');
        }
    };

    // 영상의학과 오더: 의사 배정 후 대기열에 추가
    const handleImagingOrder = async (orderId: string, encounterId?: number) => {
        if (!selectedDoctor) {
            alert('촬영을 담당할 영상의학과 의사를 선택해주세요.');
            return;
        }

        if (!window.confirm('선택한 의사에게 촬영을 배정하시겠습니까?')) {
            return;
        }

        try {
            await assignDoctorToImagingOrder(orderId, selectedDoctor);

            const isLastOrder = selectedPatient && selectedPatient.orders.length === 1;

            if (isLastOrder && encounterId) {
                alert('촬영 오더가 배정되었습니다.');

                // 수납 대기 여부 확인
                if (window.confirm('모든 오더가 처리되었습니다.\n환자를 수납(귀가) 대기로 이동시키겠습니까?')) {
                    await updateEncounter(encounterId, { workflow_state: 'WAITING_PAYMENT' });
                    alert('환자가 수납 대기 상태로 이동되었습니다.');
                    closeModal();
                }
                // 진료 대기 여부 확인
                else if (window.confirm('그럼 환자를 진료실 대기(추가 진료)로 이동시키겠습니까?')) {
                    await updateEncounter(encounterId, { workflow_state: 'WAITING_CLINIC' });
                    alert('환자가 진료 대기 상태로 이동되었습니다.');
                    closeModal();
                }
                // 그냥 닫기
                else {
                    closeModal();
                }
            } else {
                alert('촬영 오더가 배정되었습니다.');
                await fetchOrders();
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

            setShowDoctorSelect(null);
            setSelectedDoctor(null);
            fetchOrders();
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

    if (isLoading && orders.length === 0) {
        return <div className={styles.loading}>정보를 불러오는 중...</div>;
    }

    if (error) {
        return <div className={styles.error}>{error}</div>;
    }

    if (orders.length === 0) {
        return <div className={styles.emptyState}>
            {showInProgressOnly ? '진행 중인 검사가 없습니다.' : '대기 중인 추가 진료(오더)가 없습니다.'}
        </div>;
    }

    // 영상의학과 의사 필터링
    const radiologyDoctors = doctors.filter((d: Doctor) => d.department?.dept_name === '영상의학과');

    const totalPages = Math.ceil(groupedOrders.length / itemsPerPage);
    const currentOrders = groupedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <>
            <div className={styles.container}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {currentOrders.map((group) => {
                        const orderNames = group.orders.map(o => o.order_name).join(', ');
                        const firstOrder = group.orders[0];

                        return (
                            <div
                                key={group.patient_id}
                                style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#FFFFFF',
                                    borderLeft: '3px solid #B3E5FC',
                                    borderRadius: '4px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => openModal(group)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                                    e.currentTarget.style.transform = 'translateX(2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                }}
                            >
                                {/* 상태 배지 */}
                                <span style={{
                                    fontSize: '12px',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    backgroundColor: '#B3E5FC',
                                    color: '#0056b3',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap'
                                }}>
                                    오더 {group.orders.length}건
                                </span>

                                {/* 환자 이름 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                                        {group.patient_name}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '6px' }}>
                                        ({group.patient_id})
                                    </span>
                                </div>

                                {/* 검사명 */}
                                <div style={{
                                    flex: 2,
                                    fontSize: '13px',
                                    color: '#666',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {orderNames}
                                </div>

                                {/* 요청 의사 */}
                                <div style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap' }}>
                                    {firstOrder.doctor_name}
                                </div>

                                {/* 시간 */}
                                <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap' }}>
                                    {new Date(firstOrder.created_at).toLocaleString('ko-KR', {
                                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        );
                    })}
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
                                📩 오더 처리 - {selectedPatient.patient_name} ({selectedPatient.patient_id})
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
                                                    요청 의사: {order.doctor_name} ({order.department_name})
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#999' }}>
                                                    요청 시간: {new Date(order.created_at).toLocaleString('ko-KR')}
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
                                                                {radiologyDoctors.map((doc: Doctor) => (
                                                                    <option key={doc.doctor_id} value={doc.doctor_id}>
                                                                        {doc.name} ({doc.room_number || '방 미배정'})
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
                                                                onClick={() => handleImagingOrder(order.id, order.encounter_id)}
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
