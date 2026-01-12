import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MedicalRecordPage.module.css';
import { getDoctorMedicalRecords } from '../../api/doctorApi';
import type { EncounterDetail } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';

export default function MedicalRecordPage() {
    const navigate = useNavigate();
    const [records, setRecords] = useState<EncounterDetail[]>([]);
    const [loading, setLoading] = useState(false);

    // 검색 필터
    const [searchText, setSearchText] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchRecords = useCallback(async (search?: string, start?: string, end?: string) => {
        setLoading(true);
        try {
            const response = await getDoctorMedicalRecords({
                search: search !== undefined ? search : searchText,
                start_date: start !== undefined ? start : startDate,
                end_date: end !== undefined ? end : endDate
            });
            setRecords(response.results);
        } catch (error) {
            console.error('Failed to fetch medical records:', error);
        } finally {
            setLoading(false);
        }
    }, [searchText, startDate, endDate]);

    // 초기 로드만 실행
    useEffect(() => {
        fetchRecords();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            fetchRecords();
        }
    };

    const { setSelectedEncounterId, setSelectedPatientId } = useTreatment();

    const handleRowClick = (encounterId: number, patientId: string) => {
        setSelectedPatientId(patientId);
        setSelectedEncounterId(encounterId);
        navigate('/doctor/treatment');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>진료 기록</h1>
                <div className={styles.filters}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="환자명 또는 ID 검색"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={styles.searchInput}
                            style={{ paddingRight: '30px' }}
                        />
                        {searchText && (
                            <button
                                onClick={() => {
                                    setSearchText('');
                                    fetchRecords('', undefined, undefined);
                                }}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#999',
                                    fontSize: '16px',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <div className={styles.dateRange}>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                fetchRecords(undefined, e.target.value, undefined);
                            }}
                            className={styles.dateInput}
                        />
                        <span className={styles.dateSeparator}>~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                fetchRecords(undefined, undefined, e.target.value);
                            }}
                            className={styles.dateInput}
                        />
                    </div>

                </div>
            </div>

            <div className={styles.content}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>환자명</th>
                            <th>환자 ID</th>
                            <th>성별/나이</th>
                            <th>진료 일시</th>
                            <th>상태</th>
                            <th>주호소 (CC)</th>
                            <th>진단명</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className={styles.loadingCell}>
                                    로딩 중...
                                </td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={8} className={styles.emptyCell}>
                                    진료 기록이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            records.map((record, index) => (
                                <tr key={record.encounter_id} onClick={() => handleRowClick(record.encounter_id, record.patient.patient_id)} className={styles.row}>
                                    <td>{index + 1}</td>
                                    <td>{record.patient.name}</td>
                                    <td>{record.patient.patient_id}</td>
                                    <td>{record.patient.gender === 'M' ? '남' : '여'} / {record.patient.age}세</td>
                                    <td>{record.encounter_date} {record.encounter_time}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${styles[record.encounter_status]}`}>
                                            {record.encounter_status_display}
                                        </span>
                                    </td>
                                    <td>{record.chief_complaint || '-'}</td>
                                    <td>{record.diagnosis_name || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
