import React from 'react';
import styles from '../../pages/administration/Dashboard.module.css';

interface UnifiedQueueListProps {
    header: React.ReactNode;
    items: any[];
    renderItem: (item: any) => React.ReactNode;
    isLoading: boolean;
    emptyMessage: string;
    currentPage: number;
    onPageChange: (page: number) => void;
    itemsPerPage?: number;
}

export default function UnifiedQueueList({
    header,
    items,
    renderItem,
    isLoading,
    emptyMessage,
    currentPage,
    onPageChange,
    itemsPerPage = 5
}: UnifiedQueueListProps) {
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className={styles.rightQueueList}>
            {/* Header */}
            {header}

            {/* Content */}
            {isLoading && items.length === 0 ? (
                <div className={styles.loading}>정보를 불러오는 중...</div>
            ) : items.length === 0 ? (
                <div className={styles.emptyState}>{emptyMessage}</div>
            ) : (
                paginatedItems.map(renderItem)
            )}

            {/* Pagination */}
            {items.length > 0 && (
                <div className={styles.pagination}>
                    <button
                        className={styles.pageButton}
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        이전
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                        <button
                            key={pageNumber}
                            className={`${styles.pageButton} ${currentPage === pageNumber ? styles.activePage : ''}`}
                            onClick={() => onPageChange(pageNumber)}
                        >
                            {pageNumber}
                        </button>
                    ))}
                    <button
                        className={styles.pageButton}
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                    >
                        다음
                    </button>
                </div>
            )}
        </div>
    );
}
