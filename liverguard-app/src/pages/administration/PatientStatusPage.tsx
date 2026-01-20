// src/pages/administration/PatientStatusPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import styles from "./PatientStatusPage.module.css";
import { getDailyPatientStatus } from "../../api/receptionApi";
import { useWebSocketContext } from "../../context/WebSocketContext";

interface EncounterMinimal {
  encounter_id: number;
  patient_name: string;
  patient_id: string;
  gender: string;
  age: number;
  doctor_name: string | null;
  workflow_state: string;
  state_entered_at: string;
  start_time: string;
  end_time?: string;
  updated_at?: string;
}

interface DailyStats {
  total: number;
  waiting: number;
  in_progress: number;
  completed: number;
}

const PatientStatusPage: React.FC = () => {
  const [encounters, setEncounters] = useState<EncounterMinimal[]>([]);
  const [stats, setStats] = useState<DailyStats>({ total: 0, waiting: 0, in_progress: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { lastMessage } = useWebSocketContext();

  const fetchStatusData = useCallback(async () => {
    // 로딩이 필요 없을 수도 있음 (silent update) -> 하지만 최초 로드 시엔 필요.
    // 여기선 isLoading을 로컬하게 제어하지 않고, 스켈레톤 UI가 없다면 그냥 두거나,
    // 데이터가 없을 때만 로딩 표시.
    if (encounters.length === 0) setIsLoading(true);

    try {
      const data = await getDailyPatientStatus();
      // API returns: { stats: { total, waiting, in_progress, completed }, encounters: [...] }
      setStats(data.stats);
      setEncounters(data.encounters);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch daily patient status:", error);
    } finally {
      setIsLoading(false);
    }
  }, [encounters.length]);

  // Initial Load
  useEffect(() => {
    fetchStatusData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket Listener
  useEffect(() => {
    if (!lastMessage) return;

    // 대기열 변경, 환자 상태 변경 등의 이벤트가 오면 새로고침
    if (lastMessage.type === 'queue_update' || lastMessage.type === 'update_queue') {
      fetchStatusData();
    }
  }, [lastMessage, fetchStatusData]);

  // --- Helper Functions ---
  const getDuration = (start: string, end?: string) => {
    if (!start) return '-';
    // UTC/KST issues handles by creating Date object properly
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : new Date().getTime();
    const diff = Math.floor((endTime - startTime) / 60000); // minutes

    if (diff < 0) return '0분';
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0) return `${hours}시간 ${mins}분`;
    return `${mins}분`;
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'REGISTERED': return <span className={`${styles.badge} ${styles.badgeRegistered}`}>접수</span>;
      case 'WAITING_CLINIC': return <span className={`${styles.badge} ${styles.badgeWaiting}`}>진료대기</span>;
      case 'IN_CLINIC': return <span className={`${styles.badge} ${styles.badgeClinic}`}>진료중</span>;
      case 'WAITING_IMAGING': return <span className={`${styles.badge} ${styles.badgeImaging}`}>촬영대기</span>;
      case 'IN_IMAGING': return <span className={`${styles.badge} ${styles.badgeImaging}`}>촬영중</span>;
      case 'WAITING_RESULTS': return <span className={`${styles.badge} ${styles.badgeResult}`}>결과대기</span>;
      case 'WAITING_PAYMENT': return <span className={`${styles.badge} ${styles.badgePayment}`}>수납대기</span>;
      case 'COMPLETED': return <span className={`${styles.badge} ${styles.badgeCompleted}`}>완료</span>;
      case 'CANCELLED': return <span className={`${styles.badge} ${styles.badgeCancelled}`}>취소</span>;
      default: return <span className={styles.badge}>{state}</span>;
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>오늘의 환자 현황 ({new Date().toLocaleDateString()})</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>
            실시간 업데이트 중 • 최종: {lastUpdated.toLocaleTimeString()}
          </span>
          {/* Refresh button removed as per request */}
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>총 방문 환자</span>
          <span className={styles.statValue} style={{ color: '#2563eb' }}>{stats.total}</span>
          <span className={styles.statSubtext}>명</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>대기 중</span>
          <span className={styles.statValue} style={{ color: '#d97706' }}>{stats.waiting}</span>
          <span className={styles.statSubtext}>접수 + 진료대기</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>진료/검사 중</span>
          <span className={styles.statValue} style={{ color: '#16a34a' }}>{stats.in_progress}</span>
          <span className={styles.statSubtext}>진료 + 촬영 + 수납</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>진료 완료</span>
          <span className={styles.statValue} style={{ color: '#475569' }}>{stats.completed}</span>
          <span className={styles.statSubtext}>귀가 완료</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>전체 환자 목록</h3>
          <span style={{ fontSize: '13px', color: '#64748b' }}>* 상태 변경 시간 기준 정렬</span>
        </div>

        <div className={styles.tableContainer}>
          {isLoading ? (
            <div className={styles.loadingOverlay}>데이터를 불러오는 중입니다...</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colSeq}>No</th>
                  <th className={styles.colTime}>접수시간</th>
                  <th className={styles.colName}>환자명</th>
                  <th className={styles.colDoctor}>담당의</th>
                  <th className={styles.colStatus}>현재 상태</th>
                  <th className={styles.colStateTime}>상태 진입 시간</th>
                  <th className={styles.colDuration}>체류 시간</th>
                  <th className={styles.colTime}>완료 시간</th>
                </tr>
              </thead>
              <tbody>
                {encounters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.emptyState}>오늘 방문한 환자 기록이 없습니다.</td>
                  </tr>
                ) : (
                  encounters.map((item, index) => (
                    <tr key={item.encounter_id}>
                      <td style={{ textAlign: 'center' }}>{encounters.length - index}</td>
                      <td>{formatTime(item.start_time)}</td>
                      <td>
                        <div>{item.patient_name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.patient_id} ({item.gender}/{item.age}세)</div>
                      </td>
                      <td>{item.doctor_name || '-'}</td>
                      <td>{getStatusBadge(item.workflow_state)}</td>
                      <td style={{ color: '#64748b' }}>
                        {formatTime(item.state_entered_at)}
                        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                          ({getDuration(item.state_entered_at)} 전)
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: '600', color: '#334155' }}>
                          {getDuration(item.start_time, item.workflow_state === 'COMPLETED' ? item.updated_at : undefined)}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>
                        {item.workflow_state === 'COMPLETED' ? formatTime(item.updated_at) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientStatusPage;