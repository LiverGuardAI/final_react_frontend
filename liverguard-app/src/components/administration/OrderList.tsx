import React, { useState, useEffect } from 'react';
import { getPendingOrders, confirmOrder, assignDoctorToImagingOrder, type PendingOrder } from '../../api/administrationApi';
import { useDoctors } from '../../hooks/useDoctors';
import styles from './OrderList.module.css';

interface OrderListProps {
    refreshTrigger?: number;
    onOpenVitalCheckModal?: (order: PendingOrder) => void;
}

export default function OrderList({ refreshTrigger, onOpenVitalCheckModal }: OrderListProps) {
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDoctorSelect, setShowDoctorSelect] = useState<string | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);

    const { doctors } = useDoctors();

    const fetchOrders = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await getPendingOrders();
            setOrders(data.results);
        } catch (err) {
            console.error('오더 목록 조회 실패:', err);
            setError('오더 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 유전체/혈액검사 오더: 바로 수납 대기로
    const handleGenomicOrBloodOrder = async (orderId: string, type: 'LAB' | 'IMAGING') => {
        if (!window.confirm('외부 검사 요청을 접수하고 환자를 수납 단계로 이동시키겠습니까?')) {
            return;
        }

        try {
            await confirmOrder(orderId, type, 'CONFIRM_AND_DISCHARGE');
            alert('외부 검사가 접수되었으며, 환자가 수납 대기로 이동되었습니다.');
            fetchOrders();
        } catch (err) {
            console.error('오더 처리 실패:', err);
            alert('오더 처리 중 오류가 발생했습니다.');
        }
    };

    // 바이탈/신체계측 검사: 모달 열기
    const handleVitalOrPhysicalOrder = (order: PendingOrder) => {
        if (onOpenVitalCheckModal) {
            onOpenVitalCheckModal(order);
        } else {
            alert('검사 입력 기능이 준비 중입니다.');
        }
    };

    // 영상의학과 오더: 의사 배정 후 대기열에 추가
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
            alert('촬영 오더가 배정되었으며, 대기열에 추가되었습니다.');
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
        return <div className={styles.emptyState}>대기 중인 추가 진료(오더)가 없습니다.</div>;
    }

    // 영상의학과 의사 필터링
    const radiologyDoctors = doctors.filter(d => d.department?.dept_name === '영상의학과');

    return (
        <div className={styles.container}>
            <table className={styles.orderTable}>
                <thead>
                    <tr>
                        <th>요청일시</th>
                        <th>구분</th>
                        <th>환자명</th>
                        <th>검사명</th>
                        <th>요청의사</th>
                        <th>상태</th>
                        <th>관리</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((order) => {
                        const isGenomicOrBlood = order.type === 'LAB' && (order.order_type === 'GENOMIC' || order.order_type === 'BLOOD_LIVER');
                        const isVitalOrPhysical = order.type === 'LAB' && (order.order_type === 'VITAL' || order.order_type === 'PHYSICAL');
                        const isImaging = order.type === 'IMAGING';

                        return (
                            <tr key={order.id} className={styles.orderRow}>
                                <td>{new Date(order.created_at).toLocaleString('ko-KR', {
                                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                })}</td>
                                <td>
                                    <span className={`${styles.typeBadge} ${order.type === 'LAB' ? styles.lab : styles.imaging}`}>
                                        {order.type_display}
                                    </span>
                                </td>
                                <td className={styles.patientName}>
                                    {order.patient_name} <span className={styles.patientId}>({order.patient_id})</span>
                                </td>
                                <td className={styles.orderName}>{order.order_name}</td>
                                <td>{order.doctor_name}</td>
                                <td>
                                    <span className={styles.statusBadge}>{order.status_display}</span>
                                </td>
                                <td>
                                    <div className={styles.actionButtons}>
                                        {isGenomicOrBlood ? (
                                            // 유전체/혈액검사: 외부 요청 후 바로 수납
                                            <button
                                                className={styles.externalButton}
                                                onClick={() => handleGenomicOrBloodOrder(order.id, order.type as 'LAB' | 'IMAGING')}
                                                title="외부 검사 요청 후 수납 대기로 이동"
                                            >
                                                외부 요청
                                            </button>
                                        ) : isVitalOrPhysical ? (
                                            // 바이탈/신체계측: 검사 입력 모달
                                            <button
                                                className={styles.vitalButton}
                                                onClick={() => handleVitalOrPhysicalOrder(order)}
                                                title="검사 데이터 입력"
                                            >
                                                검사 입력
                                            </button>
                                        ) : isImaging ? (
                                            // 영상의학과: 의사 배정
                                            <>
                                                {showDoctorSelect === order.id ? (
                                                    <div className={styles.doctorSelectContainer}>
                                                        <select
                                                            className={styles.doctorSelect}
                                                            value={selectedDoctor || ''}
                                                            onChange={(e) => setSelectedDoctor(Number(e.target.value))}
                                                        >
                                                            <option value="">의사 선택</option>
                                                            {radiologyDoctors.map(doc => (
                                                                <option key={doc.doctor_id} value={doc.doctor_id}>
                                                                    {doc.name} ({doc.room_number || '방 미배정'})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            className={styles.assignButton}
                                                            onClick={() => handleImagingOrder(order.id)}
                                                        >
                                                            배정
                                                        </button>
                                                        <button
                                                            className={styles.cancelButton}
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
                                                        className={styles.imagingButton}
                                                        onClick={() => setShowDoctorSelect(order.id)}
                                                        title="영상의학과 의사 배정"
                                                    >
                                                        의사 배정
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            // 기본: 접수 / 접수 후 수납
                                            <>
                                                <button
                                                    className={styles.confirmButton}
                                                    onClick={() => handleConfirm(order.id, order.type as 'LAB' | 'IMAGING', 'CONFIRM')}
                                                >
                                                    접수
                                                </button>
                                                <button
                                                    className={styles.dischargeButton}
                                                    onClick={() => handleConfirm(order.id, order.type as 'LAB' | 'IMAGING', 'CONFIRM_AND_DISCHARGE')}
                                                >
                                                    접수 후 수납
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
