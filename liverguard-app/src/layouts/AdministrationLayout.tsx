import { Outlet } from "react-router-dom";
import { AdministrationProvider } from "../contexts/AdministrationContext";
import AdministrationSidebar from "../components/administration/AdministrationSidebar";
import AdministrationTopBar from "../components/administration/AdministrationTopBar";
import styles from "../pages/administration/Dashboard.module.css";

import { useState, useEffect } from 'react';

const AdministrationLayout = () => {
    // 스케줄 확인 로직
    const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    // User info can be retrieved from localStorage or a context if available.
    // AuthProvider might be better, but assuming localStorage for consistency with DoctorLayout for now.
    const { user } = JSON.parse(localStorage.getItem('user') || '{}');

    // Effect to check schedules
    useEffect(() => {
        const checkPendingSchedules = async () => {
            if (!user || !user.id) return;
            try {
                const { getDutySchedules } = await import('../api/hospitalOpsApi');
                const data = await getDutySchedules(undefined, undefined, user.id);
                // Filter for PENDING schedules
                const pending = data.filter((s: any) => s.schedule_status === 'PENDING');
                if (pending.length > 0) {
                    setPendingSchedules(pending);
                    setIsScheduleModalOpen(true);
                }
            } catch (e) {
                console.error("Failed to check schedules", e);
            }
        };
        checkPendingSchedules();
    }, [user?.id]); // Depend on user ID

    const handleConfirmSchedule = async (scheduleId: number) => {
        try {
            const { confirmDutySchedule } = await import('../api/hospitalOpsApi');
            await confirmDutySchedule(scheduleId);
            setPendingSchedules(prev => prev.filter(s => s.schedule_id !== scheduleId));
            if (pendingSchedules.length <= 1) {
                setIsScheduleModalOpen(false);
            }
            alert("스케줄이 확정되었습니다.");
        } catch (e) {
            console.error("Failed to confirm schedule", e);
            alert("스케줄 확정 실패");
        }
    };

    const handleRejectSchedule = async (scheduleId: number) => {
        const reason = window.prompt("거절 사유를 입력해주세요.\n(예: 개인 사정, 연차 사용 등)");
        if (reason === null) return; // 취소 버튼 클릭 시

        // 사유 입력 강제 여부는 선택사항이지만, 요구사항에 따라 입력하도록 유도
        if (!reason.trim()) {
            alert("거절 사유를 입력해주세요.");
            return;
        }

        try {
            const { rejectDutySchedule } = await import('../api/hospitalOpsApi');
            await rejectDutySchedule(scheduleId, reason);
            setPendingSchedules(prev => prev.filter(s => s.schedule_id !== scheduleId));
            if (pendingSchedules.length <= 1) {
                setIsScheduleModalOpen(false);
            }
            alert("스케줄을 거절(취소)했습니다.");
        } catch (e) {
            console.error("Failed to reject schedule", e);
            alert("스케줄 거절 실패");
        }
    };

    return (
        <AdministrationProvider>
            <div className={styles.container}>
                <AdministrationSidebar />
                <div className={styles.mainArea}>
                    <AdministrationTopBar />
                    <div className={styles.mainContent}>
                        <Outlet />
                    </div>
                </div>
            </div>

            {/* 스케줄 확정 모달 */}
            {isScheduleModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', width: '400px', color: '#333' }}>
                        <h3 style={{ margin: '0 0 15px' }}>📅 근무 일정 확인 요청</h3>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                            관리자가 등록한 근무 일정이 있습니다. 확인해 주세요.
                        </p>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
                            {pendingSchedules.map(sch => (
                                <div key={sch.schedule_id} style={{
                                    border: '1px solid #eee', borderRadius: '8px', padding: '10px', marginBottom: '8px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {new Date(sch.start_time).toLocaleDateString()}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#555' }}>
                                            {new Date(sch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                            {new Date(sch.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            <br />
                                            ({sch.shift_type})
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleConfirmSchedule(sch.schedule_id)}
                                        style={{
                                            background: '#2196F3', color: 'white', border: 'none', padding: '6px 12px',
                                            borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        확정
                                    </button>
                                    <button
                                        onClick={() => handleRejectSchedule(sch.schedule_id)}
                                        style={{
                                            background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px',
                                            borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '6px'
                                        }}
                                    >
                                        거절
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <button
                                onClick={() => setIsScheduleModalOpen(false)}
                                style={{
                                    background: '#f5f5f5', color: '#333', border: 'none', padding: '8px 16px',
                                    borderRadius: '6px', cursor: 'pointer'
                                }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdministrationProvider>
    );
};

export default AdministrationLayout;
