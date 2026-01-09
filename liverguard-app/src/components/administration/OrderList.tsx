import React, { useState, useEffect } from 'react';
import { getPendingOrders, confirmOrder, type PendingOrder } from '../../api/administrationApi';
import styles from './OrderList.module.css';

interface OrderListProps {
    refreshTrigger?: number; // 부모에서 갱신을 트리거할 때 사용
}

export default function OrderList({ refreshTrigger }: OrderListProps) {
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const handleConfirm = async (orderId: string, type: 'LAB' | 'IMAGING', action: 'CONFIRM' | 'CONFIRM_AND_DISCHARGE') => {
        if (!window.confirm(action === 'CONFIRM_AND_DISCHARGE' ? '오더를 접수하고 환자를 수납(귀가) 단계로 이동시키겠습니까?' : '오더를 접수하시겠습니까?')) {
            return;
        }

        try {
            await confirmOrder(orderId, type, action);
            alert('처리되었습니다.');
            fetchOrders(); // 목록 갱신
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
                    {orders.map((order) => (
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
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
