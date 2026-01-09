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

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getDoctorMedicalRecords({
                search: searchText,
                start_date: startDate || undefined,
                end_date: endDate || undefined
            });
            setRecords(response.results);
        } catch (error) {
            console.error('Failed to fetch medical records:', error);
        } finally {
            setLoading(false);
        }
    }, [searchText, startDate, endDate]);

    // 초기 로드 및 필터 변경 시 조회 (디바운스 필요할 수 있으나 일단 버튼 혹은 엔터로 처리하는게 좋을수도? 
    // 여기서는 useEffect로 즉시 반영 - 요구사항: 리스트 및 검색창)
    useEffect(() => {
        // 디바운스 처리 (500ms)
        const timer = setTimeout(() => {
            fetchRecords();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchRecords]);

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
                    <input
                        type="text"
                        placeholder="환자명 또는 ID 검색"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className={styles.searchInput}
                    />
                    <div className={styles.dateRange}>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={styles.dateInput}
                        />
                        <span className={styles.dateSeparator}>~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
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
