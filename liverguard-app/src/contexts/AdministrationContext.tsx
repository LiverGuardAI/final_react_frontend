import React, { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import { useWaitingQueue } from '../hooks/useWaitingQueue';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useDoctors } from '../hooks/useDoctors';
import { useWebSocketContext } from '../context/WebSocketContext';

interface AdministrationContextType {
    // Stats & Queue
    waitingQueueData: any;
    isLoadingQueue: boolean;
    dashboardStats: any;
    fetchWaitingQueue: () => Promise<void>;
    fetchDashboardStats: () => Promise<void>;

    // Doctors
    doctors: any[];
    fetchDoctors: () => Promise<void>;

    // Radiologists
    radiologists: any[];
    fetchRadiologists: () => Promise<void>;

    // Patients
    refreshPatientsTrigger: number;
    triggerPatientRefresh: () => void;
}

const AdministrationContext = createContext<AdministrationContextType | undefined>(undefined);

export const AdministrationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { waitingQueueData, isLoading, fetchWaitingQueue } = useWaitingQueue();
    const { stats: dashboardStats, fetchStats: fetchDashboardStats } = useDashboardStats();
    const { doctors, fetchDoctors } = useDoctors();

    // Radiologists State
    const [radiologists, setRadiologists] = useState<any[]>([]);

    const fetchRadiologists = useCallback(async () => {
        try {
            const { getRadiologists } = await import('../api/receptionApi');
            const data = await getRadiologists();
            setRadiologists(data.results || data);
        } catch (err) {
            console.error("Failed to fetch radiologists:", err);
        }
    }, []);

    const [refreshPatientsTrigger, setRefreshPatientsTrigger] = useState(0);

    const triggerPatientRefresh = useCallback(() => {
        setRefreshPatientsTrigger(prev => prev + 1);
    }, []);

    // WebSocket (Global Context 사용)
    const { lastMessage } = useWebSocketContext();

    useEffect(() => {
        if (!lastMessage) return;

        const data = lastMessage;
        console.log("WebSocket Message (Admin Context via Global):", data);

        if (data.type === 'patient_update') {
            console.log("Global Patient Update Signal");
            triggerPatientRefresh();
        }
        if (data.type === 'queue_update') {
            console.log("Global Queue Update Signal");
            fetchWaitingQueue();
            fetchDashboardStats();
        }
        if (data.type === 'stats_update') {
            console.log("Global Stats Update Signal");
            fetchDashboardStats();
        }
        if (data.type === 'questionnaire_update') {
            console.log("Global Questionnaire Update Signal", data.data);
            // 문진표 업데이트 시 대기열 새로고침 (문진표 상태 반영)
            fetchWaitingQueue();
        }
    }, [lastMessage, triggerPatientRefresh, fetchWaitingQueue, fetchDashboardStats]);

    // Fetch initial data
    useEffect(() => {
        fetchDoctors();
        fetchRadiologists();
        fetchWaitingQueue();
        fetchDashboardStats();
    }, [fetchDoctors, fetchWaitingQueue, fetchDashboardStats]);

    return (
        <AdministrationContext.Provider value={{
            waitingQueueData,
            dashboardStats,
            fetchWaitingQueue,
            isLoadingQueue: isLoading, // Expose loading state
            fetchDashboardStats,
            doctors,
            fetchDoctors,
            radiologists,
            fetchRadiologists,
            refreshPatientsTrigger,
            triggerPatientRefresh
        }}>
            {children}
        </AdministrationContext.Provider>
    );
};

export const useAdministrationData = () => {
    const context = useContext(AdministrationContext);
    if (context === undefined) {
        throw new Error('useAdministrationData must be used within an AdministrationProvider');
    }
    return context;
};
