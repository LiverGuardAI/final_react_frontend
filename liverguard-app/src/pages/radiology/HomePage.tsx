import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useChatContext } from "../../context/ChatContext";
import ChatDropdown from "../../components/common/ChatDropdown";
import "./HomePage.css";
import { useState, useEffect } from "react";

export default function RadiologyHomePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { totalUnreadCount: chatUnreadCount } = useChatContext();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("radiology");

    logout();
    navigate("/");
  };

  // 채팅 상태
  const [showChat, setShowChat] = useState(false);

  // 스케줄 확인 로직
  const [pendingSchedules, setPendingSchedules] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    const checkPendingSchedules = async () => {
      const userId = user?.user_id ?? user?.id;
      if (!userId) return;
      try {
        const { getDutySchedules } = await import('../../api/hospitalOpsApi');
        const data = await getDutySchedules(undefined, undefined, userId, 'PENDING');
        const pending = data;
        if (pending.length > 0) {
          setPendingSchedules(pending);
          setIsScheduleModalOpen(true);
        }
      } catch (e) {
        console.error("Failed to check schedules", e);
      }
    };
    checkPendingSchedules();
  }, [user?.id, user?.user_id]);

  const handleConfirmSchedule = async (scheduleId: number) => {
    try {
      const { confirmDutySchedule } = await import('../../api/hospitalOpsApi');
      await confirmDutySchedule(scheduleId);
      setPendingSchedules((prev: any[]) => prev.filter(s => s.schedule_id !== scheduleId));
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
    try {
      const { rejectDutySchedule } = await import('../../api/hospitalOpsApi');
      await rejectDutySchedule(scheduleId);
      setPendingSchedules((prev: any[]) => prev.filter(s => s.schedule_id !== scheduleId));
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
    <div className="radiology-home-page">
      <header className="radiology-header">
        <h1>영상의학과 홈페이지</h1>
        <div className="header-actions">
          <div className="chat-container">
            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className="icon-btn"
              title="메시지"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z" fill="currentColor" />
              </svg>
              {chatUnreadCount > 0 && <span className="chat-badge">{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</span>}
            </button>
            <ChatDropdown isOpen={showChat} onClose={() => setShowChat(false)} />
          </div>
          <button type="button" onClick={handleLogout} className="logout-btn">
            로그아웃
          </button>
        </div>
      </header>

      <div className="radiology-content">
        <div className="nav-cards">
          <div className="nav-card" onClick={() => navigate("/radiology/acquisition")}>
            <div className="card-icon">📷</div>
            <h2>촬영 페이지</h2>
            <p>DICOM 영상 촬영 및 업로드</p>
          </div>

          <div className="nav-card" onClick={() => navigate("/radiology/post-processing")}>
            <div className="card-icon">🖼️</div>
            <h2>영상 후처리 페이지</h2>
            <p>Segmentation 및 후처리 작업</p>
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
              {pendingSchedules.map((sch: any) => (
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
    </div>
  );
}
