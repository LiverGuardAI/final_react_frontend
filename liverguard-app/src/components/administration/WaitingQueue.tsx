import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '../../hooks/useWebSocket';

// 타입 정의
interface Patient {
  encounter_id: number;
  patient_name: string;
  patient_id: string;
  priority: number;
}

const WaitingQueue: React.FC = () => {
  const [queue, setQueue] = useState<Patient[]>([]);

  // API 주소 설정
  const API_BASE_URL = `http://${window.location.hostname}:8000`;

  const fetchQueue = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/administration/queue/`);
      setQueue(response.data.queue || []);
    } catch (error) {
      console.error("대기열 불러오기 실패", error);
    }
  };

  // WebSocket 연결 (Custom Hook 사용)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_URL = `${protocol}//${window.location.hostname}:8000/ws/clinic/`;

  useWebSocket(WS_URL, {
    onMessage: (data) => {
      if (data.type === 'queue_update') {
        console.log("🔔 새 환자 알림 도착!");
        fetchQueue();
      }
    },
    onOpen: () => {
      console.log("✅ 원무과 대기열 실시간 연결됨");
    },
  });

  useEffect(() => {
    // 초기 데이터 로드
    fetchQueue();
  }, []);

  return (
    <div className={styles.queueContainer}> {/* CSS 클래스는 HomePage의 것을 쓰거나 새로 정의 */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '10px' }}>
        📋 실시간 진료 대기 ({queue.length}명)
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto' }}>
        {queue.length === 0 ? (
          <li style={{ padding: '10px', color: '#999', textAlign: 'center' }}>대기 환자가 없습니다.</li>
        ) : (
          queue.map((p, idx) => (
            <li key={idx} style={{ 
              padding: '12px', 
              borderBottom: '1px solid #eee', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fff'
            }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{p.patient_name}</span>
                <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '8px' }}>
                  ({p.patient_id})
                </span>
              </div>
              <span style={{ 
                color: p.priority <= 3 ? 'red' : 'blue',
                fontWeight: 'bold' 
              }}>
                대기중
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

// 스타일이 필요하면 HomePage.module.css에 정의해서 className으로 쓰거나, 
// 간단하게 인라인 스타일을 쓰세요. 여기서는 styles 변수 대신 인라인이나 기본 div를 씁니다.
const styles = {
    queueContainer: "bg-white shadow rounded-lg p-4" // Tailwind 쓴다면 이런 식
};

export default WaitingQueue;