import React from 'react';
import styles from '../../pages/administration/HomePage.module.css';

interface Patient {
  id: string;
  name: string;
  birthDate: string;
  age: number;
  gender: string;
  phone: string;
  registrationDate: string;
}

interface PatientSearchPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  patients: Patient[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPatientClick: (patient: Patient) => void;
  onCheckinClick: (patient: Patient) => void;
  waitingPatientIds?: string[]; // 이미 대기 중인 환자 ID 목록
}

const PatientSearchPanel: React.FC<PatientSearchPanelProps> = ({
  searchQuery,
  onSearchChange,
  patients,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onPatientClick,
  onCheckinClick,
  waitingPatientIds = [],
}) => {
  const patientsPerPage = 5;
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = patients.slice(indexOfFirstPatient, indexOfLastPatient);

  return (
    <div>
      {/* 검색 바 */}
      <div className={styles.searchBar}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            placeholder="환자 이름 또는 ID로 검색..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.searchInput}
            style={{ paddingRight: '30px', width: '100%' }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#999',
                fontSize: '16px',
                padding: '0',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 환자 테이블 */}
      <div className={styles.patientListTable}>
        {isLoading ? (
          <div>로딩 중...</div>
        ) : currentPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            환자가 없습니다.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>환자 ID</th>
                <th>이름</th>
                <th>생년월일</th>
                <th>나이</th>
                <th>성별</th>
                <th>연락처</th>
                <th>등록일</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {currentPatients.map((patient) => {
                const isWaiting = waitingPatientIds.includes(patient.id);
                return (
                  <tr key={patient.id}>
                    <td>{patient.id}</td>
                    <td>
                      <button
                        onClick={() => onPatientClick(patient)}
                        className={styles.patientNameButton}
                      >
                        {patient.name}
                      </button>
                    </td>
                    <td>{patient.birthDate}</td>
                    <td>{patient.age}세</td>
                    <td>{patient.gender}</td>
                    <td>{patient.phone}</td>
                    <td>{patient.registrationDate}</td>
                    <td>
                      {isWaiting ? (
                        <span className={styles.alreadyCheckedIn}>접수 완료</span>
                      ) : (
                        <button
                          className={styles.checkinButton}
                          onClick={() => onCheckinClick(patient)}
                          title="현장 접수"
                        >
                          현장 접수
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {!isLoading && patients.length > 0 && (
        <div className={styles.pagination}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            이전
          </button>
          <span className={styles.pageInfo}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={styles.paginationButton}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientSearchPanel;
