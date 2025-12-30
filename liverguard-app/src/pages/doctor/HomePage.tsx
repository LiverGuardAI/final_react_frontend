import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorLayout from '../../layouts/DoctorLayout';

interface Patient {
  id: number;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  lastVisit?: string;
}

export default function DoctorHomePage() {
  const navigate = useNavigate();

  // 샘플 환자 데이터
  const [waitingPatients] = useState<Patient[]>([
    { id: 1, name: '장보윤', birthDate: '2000.05.21', age: 26, gender: '여' },
    { id: 2, name: '송영운', birthDate: '2000.05.21', age: 26, gender: '남' },
    { id: 3, name: '정예진', birthDate: '2000.05.21', age: 26, gender: '여' },
  ]);

  const [completedPatients] = useState<Patient[]>([]);

  const patientStatus = {
    waiting: waitingPatients.length,
    inProgress: 0,
    completed: completedPatients.length,
  };

  const totalPatients = patientStatus.waiting + patientStatus.inProgress + patientStatus.completed;
  const waitingPercentage = totalPatients > 0 ? (patientStatus.waiting / totalPatients) * 100 : 0;
  const inProgressPercentage = totalPatients > 0 ? (patientStatus.inProgress / totalPatients) * 100 : 0;
  const completedPercentage = totalPatients > 0 ? (patientStatus.completed / totalPatients) * 100 : 0;

  return (
    <DoctorLayout activeTab="home">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto 1fr', gap: '20px', padding: '20px', height: '100%', boxSizing: 'border-box', zoom: '0.7' }}>
        {/* 첫 번째 행 왼쪽: 오늘의 진료 현황 */}
        <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>오늘의 진료 현황</h2>
            <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
          </div>
          <div style={{ background: '#FFF', borderRadius: '15px', padding: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, overflow: 'auto' }}>
            {/* 간단한 막대 그래프 */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', color: '#666' }}>대기 환자</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.waiting}명</span>
                </div>
                <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${waitingPercentage}%`, height: '100%', background: '#FFB800', transition: 'width 0.3s' }}></div>
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', color: '#666' }}>진료 중</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.inProgress}명</span>
                </div>
                <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${inProgressPercentage}%`, height: '100%', background: '#00A3FF', transition: 'width 0.3s' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', color: '#666' }}>완료 환자</span>
                  <span style={{ fontSize: '16px', fontWeight: '600' }}>{patientStatus.completed}명</span>
                </div>
                <div style={{ width: '100%', height: '24px', background: '#F5F5F5', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${completedPercentage}%`, height: '100%', background: '#8BC34A', transition: 'width 0.3s' }}></div>
                </div>
              </div>
            </div>
            {/* 대기 환자 정보 */}
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px' }}>대기 환자:</h3>
              {waitingPatients.slice(0, 2).map((patient) => (
                <div key={patient.id} style={{ marginBottom: '10px', fontSize: '16px', color: '#666' }}>
                  • {patient.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 상단: 일정 관리 */}
        <div style={{ gridColumn: '2', gridRow: '1', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>일정 관리</h2>
            <span style={{ fontSize: '16px', fontWeight: '400', color: '#666' }}>2025.12.11</span>
            <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
          </div>
          <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0 }}>
            {/* 간단한 캘린더 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} style={{ fontSize: '12px', fontWeight: '600', color: '#999', padding: '8px 0' }}>{day}</div>
              ))}
              {/* 11월 달력 (30일부터 시작) */}
              {[30, 31].map((day) => (
                <div key={`prev-${day}`} style={{ fontSize: '13px', color: '#CCC', padding: '8px', borderRadius: '8px' }}>{day}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isToday = day === 25;
                return (
                  <div
                    key={day}
                    style={{
                      fontSize: '13px',
                      padding: '8px',
                      borderRadius: '8px',
                      background: isToday ? '#6B58B1' : 'transparent',
                      color: isToday ? '#FFF' : '#000',
                      fontWeight: isToday ? '600' : '400',
                      cursor: 'pointer'
                    }}
                  >
                    {day}
                  </div>
                );
              })}
              {[1, 2, 3, 4, 5].map((day) => (
                <div key={`next-${day}`} style={{ fontSize: '13px', color: '#CCC', padding: '8px', borderRadius: '8px' }}>{day}</div>
              ))}
            </div>
          </div>
        </div>

        {/* 두 번째 행: 빠른 실행 + 최근 환자 내역 */}
        <div style={{ gridColumn: '1 / 3', gridRow: '2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: 0 }}>
          {/* 빠른 실행 */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
                빠른 실행
              </h2>
              <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
            </div>
            <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button style={{ background: '#E3F2FD', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                    <path d="M24 14C21.79 14 20 15.79 20 18C20 20.21 21.79 22 24 22C26.21 22 28 20.21 28 18C28 15.79 26.21 14 24 14ZM24 24C20.67 24 14 25.67 14 29V31C14 31.55 14.45 32 15 32H33C33.55 32 34 31.55 34 31V29C34 25.67 27.33 24 24 24Z" fill="#1976D2"/>
                    <rect x="14" y="16" width="20" height="2" rx="1" fill="#1976D2"/>
                    <rect x="14" y="20" width="16" height="2" rx="1" fill="#1976D2"/>
                    <rect x="14" y="24" width="18" height="2" rx="1" fill="#1976D2"/>
                  </svg>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#1976D2' }}>환자 접수</span>
                </button>
                <button style={{ background: '#FFF3E0', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                    <rect x="14" y="16" width="20" height="2" rx="1" fill="#F57C00"/>
                    <rect x="14" y="20" width="16" height="2" rx="1" fill="#F57C00"/>
                    <rect x="14" y="24" width="18" height="2" rx="1" fill="#F57C00"/>
                    <circle cx="31" cy="31" r="7" fill="#F57C00"/>
                    <path d="M31 27V35M27 31H35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#F57C00' }}>일정 추가</span>
                </button>
                <button style={{ background: '#E8F5E9', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                    <rect x="16" y="14" width="16" height="20" rx="2" fill="white" stroke="#388E3C" strokeWidth="2"/>
                    <path d="M20 20H28M20 24H28M20 28H25" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="32" cy="32" r="6" fill="#388E3C"/>
                    <path d="M29.5 32L31 33.5L34.5 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#388E3C' }}>검사 결과</span>
                </button>
                <button onClick={() => navigate('/doctor/ct-result')} style={{ background: '#F3E5F5', border: 'none', borderRadius: '12px', padding: '20px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <svg width="50" height="50" viewBox="0 0 48 48" fill="none">
                    <rect x="14" y="18" width="20" height="16" rx="2" fill="white" stroke="#7B1FA2" strokeWidth="2"/>
                    <circle cx="24" cy="22" r="2" fill="#7B1FA2"/>
                    <path d="M19 26C19 28.21 21.24 30 24 30C26.76 30 29 28.21 29 26" stroke="#7B1FA2" strokeWidth="2" strokeLinecap="round"/>
                    <rect x="15" y="19" width="18" height="14" rx="1" stroke="#7B1FA2" strokeWidth="1.5" strokeDasharray="2 2"/>
                  </svg>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#7B1FA2' }}>CT 촬영</span>
                </button>
              </div>
            </div>
          </div>

          {/* 최근 환자 내역 */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>최근 환자 내역</h2>
              <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
            </div>
            <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0 }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>정예진 (여, 29세)</div>
                <div style={{ fontSize: '15px', color: '#666', marginBottom: '8px' }}>• 주증상: 간암</div>
                <div style={{ fontSize: '15px', color: '#666', marginBottom: '12px' }}>• 특이사항: 알레르기</div>
                <div style={{ fontSize: '15px', color: '#666', marginBottom: '8px' }}>• CT 촬영 여부: O</div>
                <div style={{ fontSize: '15px', color: '#666', marginBottom: '18px' }}>• 유전체 검사/혈액 검사 여부: O</div>
                <button style={{ width: '100%', background: '#D7E8FB', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '600', color: '#52759C', cursor: 'pointer' }}>
                  진료 기록 보기
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 세 번째 행: 최근 알림 */}
        <div style={{ gridColumn: '1 / 3', gridRow: '3', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>최근 알림</h2>
            <span style={{ fontSize: '28px', cursor: 'pointer', fontWeight: '300', lineHeight: '1' }}>›</span>
          </div>
          <div style={{ background: '#FFF', borderRadius: '15px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1, overflow: 'auto', minHeight: 0 }}>
            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #E0E0E0' }}>
              <div style={{ fontSize: '16px', color: '#000', marginBottom: '5px' }}>• 새로운 메시지: 장재운 님 (2개)</div>
            </div>
            <div>
              <div style={{ fontSize: '16px', color: '#000' }}>• 병원 공지: 12/25일 크리스마스 휴강</div>
            </div>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
