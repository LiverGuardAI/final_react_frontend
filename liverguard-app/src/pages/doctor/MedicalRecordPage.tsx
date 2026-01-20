import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './MedicalRecordPage.module.css';
import { getDoctorMedicalRecords, getEncounterDetail } from '../../api/doctorApi';
import type { EncounterDetail } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';

function RecordDetailModal({ encounterId, onClose }: { encounterId: number; onClose: () => void }) {
    const [detail, setDetail] = useState<EncounterDetail | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    useEffect(() => {
        const loadDetail = async () => {
            setModalLoading(true);
            try {
                const data = await getEncounterDetail(encounterId);
                setDetail(data);
            } catch (error) {
                console.error("상세 정보 로드 실패", error);
            } finally {
                setModalLoading(false);
            }
        };
        loadDetail();
    }, [encounterId]);
    if (modalLoading) return <div className={styles.modalOverlay}><div className={styles.modalContent}>로딩 중...</div></div>;
    if (!detail) return null;
    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>진료 기록 상세</h2>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className={styles.modalBody}>
                    <p><strong>환자명:</strong> {detail.patient.name} ({detail.patient.patient_id})</p>
                    <p><strong>성별/나이:</strong> {detail.patient.gender === 'M' ? '남' : '여'} / {detail.patient.age}세</p>
                    <p><strong>진료일시:</strong> {detail.encounter_date} {detail.encounter_time}</p>
                    <p><strong>상태:</strong> {detail.encounter_status_display}</p>
                    <hr />
                    <h3>주증상 (CC)</h3>
                    <p>{detail.chief_complaint || '없음'}</p>
                    <h3>진단명</h3>
                    <p>{detail.diagnosis_name || '없음'}</p>
                    <h3>진료 소견</h3>
                    <p>{detail.clinical_notes || '없음'}</p>
                </div>
                <div className={styles.modalFooter}>
                    <button onClick={onClose} className={styles.closeButton}>닫기</button>
                </div>
            </div>
        </div>
    );
}

export default function MedicalRecordPage() {
    const navigate = useNavigate();
    const [records, setRecords] = useState<EncounterDetail[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

    // 검색 필터
    const [searchText, setSearchText] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [searchParams] = useSearchParams();
    const searchTextRef = useRef(searchText);
    const startDateRef = useRef(startDate);
    const endDateRef = useRef(endDate);

    useEffect(() => {
        searchTextRef.current = searchText;
    }, [searchText]);

    useEffect(() => {
        startDateRef.current = startDate;
    }, [startDate]);

    useEffect(() => {
        endDateRef.current = endDate;
    }, [endDate]);

    const fetchRecords = useCallback(async (search?: string, start?: string, end?: string) => {
        setLoading(true);
        try {
            const response = await getDoctorMedicalRecords({
                search: search !== undefined ? search : searchTextRef.current,
                start_date: start !== undefined ? start : startDateRef.current,
                end_date: end !== undefined ? end : endDateRef.current
            });
            setRecords(response.results);
        } catch (error) {
            console.error('Failed to fetch medical records:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // 초기 로드 + URL 검색어 반영
    useEffect(() => {
        const searchValue = searchParams.get('search');
        if (searchValue) {
            setSearchText(searchValue);
            fetchRecords(searchValue);
            return;
        }
        fetchRecords();
    }, [fetchRecords, searchParams]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            fetchRecords();
        }
    };

    const { setSelectedEncounterId, setSelectedPatientId } = useTreatment();

    const handleRowClick = (encounterId: number) => {
        setSelectedRecordId(encounterId);
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
                                <tr key={record.encounter_id} onClick={() => handleRowClick(record.encounter_id)} className={styles.row}>
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
            {/* [추가] 모달 렌더링 */}
            {selectedRecordId && (
                <RecordDetailModal
                    encounterId={selectedRecordId}
                    onClose={() => setSelectedRecordId(null)}
                />
            )}
        </div>
    );
}
