import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './MedicalRecordPage.module.css';
import { getDoctorMedicalRecords, getEncounterDetail } from '../../api/doctorApi';
import type { EncounterDetail } from '../../api/doctorApi';
import { useTreatment } from '../../contexts/TreatmentContext';

const formatDisplayValue = (value?: string | null, fallback = '-') => {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toUpperCase() === 'N/A') return fallback;
    return trimmed;
};

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
                    <p>{formatDisplayValue(detail.chief_complaint, '없음')}</p>
                    <h3>진단명</h3>
                    <p>{formatDisplayValue(detail.diagnosis_name, '없음')}</p>
                    <h3>진료 소견</h3>
                    <p>{formatDisplayValue(detail.clinical_notes, '없음')}</p>
                </div>
                <div className={styles.modalFooter}>
                    <button onClick={onClose} className={styles.closeButton}>닫기</button>
                </div>
            </div>
        </div>
    );
}

export default function MedicalRecordPage() {
    const [records, setRecords] = useState<EncounterDetail[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // 검색 필터
    const [searchText, setSearchText] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // 정렬 옵션
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'severity'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
            setTotalCount(response.count ?? response.results.length);
            setCurrentPage(1);
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

    // 정렬 로직 추가
    const sortedRecords = [...records].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'date':
                const dateA = new Date(`${a.encounter_date} ${a.encounter_time}`).getTime();
                const dateB = new Date(`${b.encounter_date} ${b.encounter_time}`).getTime();
                comparison = dateA - dateB;
                break;
            case 'name':
                comparison = a.patient.name.localeCompare(b.patient.name, 'ko');
                break;
            case 'severity':
                // 상태 우선순위: WAITING > IN_PROGRESS > COMPLETED > CANCELLED
                const severityOrder = { 'WAITING': 0, 'IN_PROGRESS': 1, 'COMPLETED': 2, 'CANCELLED': 3 };
                const severityA = severityOrder[a.encounter_status as keyof typeof severityOrder] ?? 999;
                const severityB = severityOrder[b.encounter_status as keyof typeof severityOrder] ?? 999;
                comparison = severityA - severityB;
                break;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
    });

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const pagedRecords = sortedRecords.slice(startIndex, startIndex + pageSize);
    const pageNumbers = (() => {
        const maxButtons = 5;
        const half = Math.floor(maxButtons / 2);
        let start = Math.max(1, safePage - half);
        let end = start + maxButtons - 1;
        if (end > totalPages) {
            end = totalPages;
            start = Math.max(1, end - maxButtons + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    })();

    useEffect(() => {
        if (safePage !== currentPage) {
            setCurrentPage(safePage);
        }
    }, [safePage, currentPage]);

    const handleResetFilters = () => {
        setSearchText('');
        setStartDate('');
        setEndDate('');
        setSortBy('date');
        setSortOrder('desc');
        fetchRecords('', '', '');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.titleGroup}>
                        <h1 className={styles.title}>진료 기록</h1>
                    </div>
                    <div className={styles.headerActions}>
                        <div className={styles.summaryCard}>
                            <span className={styles.summaryLabel}>전체</span>
                            <span className={styles.summaryValue}>
                                {loading ? '...' : totalCount.toLocaleString('ko-KR')}
                            </span>
                            <span className={styles.summaryUnit}>건</span>
                        </div>
                        <button type="button" className={styles.secondaryButton} onClick={handleResetFilters}>
                            필터 초기화
                        </button>
                        <button type="button" className={styles.primaryButton} onClick={() => fetchRecords()}>
                            새로고침
                        </button>
                    </div>
                </div>
                <div className={styles.menuBar}>
                    <div className={styles.menuGroup}>
                        <span className={styles.menuLabel}>검색</span>
                        <div className={styles.searchField}>
                            <input
                                type="text"
                                placeholder="환자명 또는 ID 검색"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className={styles.searchInput}
                            />
                            {searchText && (
                                <button
                                    type="button"
                                    className={styles.clearButton}
                                    onClick={() => {
                                        setSearchText('');
                                        fetchRecords('', undefined, undefined);
                                    }}
                                    aria-label="검색어 지우기"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div className={styles.menuGroup}>
                        <span className={styles.menuLabel}>기간</span>
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
                    <div className={styles.menuGroup}>
                        <span className={styles.menuLabel}>정렬</span>
                        <div className={styles.sortControls}>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'severity')}
                                className={styles.sortSelect}
                            >
                                <option value="date">날짜순</option>
                                <option value="name">환자명순</option>
                                <option value="severity">중증도순</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className={styles.sortOrderButton}
                                title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
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
                            pagedRecords.map((record, index) => (
                                <tr key={record.encounter_id} onClick={() => handleRowClick(record.encounter_id)} className={styles.row}>
                                    <td>{startIndex + index + 1}</td>
                                    <td>{record.patient.name}</td>
                                    <td>{record.patient.patient_id}</td>
                                    <td>{record.patient.gender === 'M' ? '남' : '여'} / {record.patient.age}세</td>
                                    <td>{record.encounter_date} {record.encounter_time}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${styles[record.encounter_status]}`}>
                                            {record.encounter_status_display}
                                        </span>
                                    </td>
                                    <td>{formatDisplayValue(record.chief_complaint)}</td>
                                    <td>{formatDisplayValue(record.diagnosis_name)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className={styles.paginationBar}>
                    <div className={styles.pageInfo}>
                        {startIndex + 1}-{Math.min(startIndex + pageSize, totalCount)} / {totalCount}
                    </div>
                    <div className={styles.paginationControls}>
                        <button
                            className={styles.pageButton}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={safePage === 1}
                        >
                            이전
                        </button>
                        {pageNumbers.map((page) => (
                            <button
                                key={page}
                                className={`${styles.pageButton} ${page === safePage ? styles.activePage : ''}`}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            className={styles.pageButton}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={safePage === totalPages}
                        >
                            다음
                        </button>
                    </div>
                    <div className={styles.pageSizeSelector}>
                        <span>페이지당</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className={styles.pageSizeSelect}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>
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
