import { useState, useEffect } from 'react';
import { useWebSocketContext } from '../../context/WebSocketContext';
import './ImagingQueueSidebar.css';

interface ImagingPatient {
  encounter_id: number;
  patient_id: string;
  patient_name: string;
  age: number;
  gender: string;
  workflow_state: string;
  workflow_state_display: string;
  state_entered_at: string;
  waiting_minutes: number;
  doctor_name: string;
  imaging_orders: {
    order_id: number;
    modality: string;
    body_part: string;
    priority: string;
    status: string;
    ordered_at: string;
  }[];
}

interface ImagingQueueData {
  success: boolean;
  message: string;
  count: number;
  stats: {
    waiting: number;
    in_progress: number;
  };
  patients: ImagingPatient[];
}

export default function ImagingQueueSidebar() {
  const [imagingQueueData, setImagingQueueData] = useState<ImagingQueueData | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'waiting' | 'completed'>('waiting');

  // 촬영 대기열 가져오기
  const fetchImagingQueue = async () => {
    try {
      const response = await fetch('/api/radiology/waitlist/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setImagingQueueData(data);
    } catch (error) {
      console.error('Failed to fetch imaging queue:', error);
    }
  };

  // 촬영 대기열 초기 로드
  useEffect(() => {
    fetchImagingQueue();
  }, []);

  // WebSocket 업데이트 시 촬영 대기열 갱신
  const { lastMessage } = useWebSocketContext();
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'queue_update') {
      const queueType = lastMessage.data?.queue_type;
      if (queueType === 'imaging') {
        fetchImagingQueue();
      }
    }
  }, [lastMessage]);

  // 촬영 대기 환자 필터링
  const waitingPatients = imagingQueueData?.patients.filter(p =>
    p.workflow_state === 'WAITING_IMAGING' || p.workflow_state === 'IN_IMAGING'
  ) || [];

  // 촬영 완료 환자는 현재 API에서 제공하지 않으므로 빈 배열로 처리
  const completedPatients: ImagingPatient[] = [];

  return (
    <div className="imaging-queue-sidebar">
      <div className="sidebar-header">
        <h2>촬영 대기열</h2>
        <div className="sidebar-stats">
          <span className="stat-badge waiting">
            대기: {imagingQueueData?.stats.waiting || 0}명
          </span>
          <span className="stat-badge in-progress">
            촬영중: {imagingQueueData?.stats.in_progress || 0}명
          </span>
        </div>
      </div>

      <div className="sidebar-tabs">
        <button
          className={sidebarTab === 'waiting' ? 'tab-active' : ''}
          onClick={() => setSidebarTab('waiting')}
        >
          촬영대기 ({waitingPatients.length}명)
        </button>
        <button
          className={sidebarTab === 'completed' ? 'tab-active' : ''}
          onClick={() => setSidebarTab('completed')}
        >
          촬영완료 ({completedPatients.length}명)
        </button>
      </div>

      <div className="sidebar-content">
        {sidebarTab === 'waiting' && (
          <div className="patient-list">
            {waitingPatients.length === 0 ? (
              <div className="empty-state">대기 중인 환자가 없습니다</div>
            ) : (
              waitingPatients.map(patient => (
                <div key={patient.encounter_id} className="patient-card">
                  <div className="patient-info">
                    <div className="patient-name">{patient.patient_name}</div>
                    <div className="patient-details">
                      {patient.age}세 / {patient.gender === 'M' ? '남' : '여'}
                    </div>
                    <div className="patient-meta">
                      담당의사: {patient.doctor_name}
                    </div>
                    <div className="patient-meta">
                      대기시간: {patient.waiting_minutes}분
                    </div>
                  </div>

                  <div className="patient-status">
                    <span className={`status-badge ${patient.workflow_state === 'IN_IMAGING' ? 'in-progress' : 'waiting'}`}>
                      {patient.workflow_state_display}
                    </span>
                  </div>

                  <div className="imaging-orders">
                    {patient.imaging_orders.map(order => (
                      <div key={order.order_id} className="order-item">
                        <span className="order-modality">{order.modality}</span>
                        <span className="order-body-part">{order.body_part}</span>
                        {order.priority === 'URGENT' && (
                          <span className="urgent-badge">응급</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {sidebarTab === 'completed' && (
          <div className="patient-list">
            <div className="empty-state">촬영 완료 내역이 없습니다</div>
          </div>
        )}
      </div>
    </div>
  );
}
