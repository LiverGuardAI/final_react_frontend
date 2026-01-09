import React from 'react';
import { useAdministrationData } from '../../contexts/AdministrationContext';

const WaitingQueue: React.FC = () => {
  const { waitingQueueData } = useAdministrationData();
  const queue = waitingQueueData?.queue || [];

  return (
    <div className={styles.queueContainer}>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '10px' }}>
        📋 실시간 진료 대기 ({queue.length}명)
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto' }}>
        {queue.length === 0 ? (
          <li style={{ padding: '10px', color: '#999', textAlign: 'center' }}>대기 환자가 없습니다.</li>
        ) : (
          queue.map((p: any, idx: number) => (
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
                color: (p.priority || 0) <= 3 ? 'red' : 'blue',
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