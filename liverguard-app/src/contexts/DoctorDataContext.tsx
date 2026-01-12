import { createContext, useContext, type ReactNode } from 'react';
import type { WaitingQueueResponse, DoctorDashboardStats } from '../api/doctorApi';

interface DoctorDataContextType {
    waitingQueueData: WaitingQueueResponse | null;
    stats: DoctorDashboardStats;
    fetchWaitingQueue: () => Promise<WaitingQueueResponse | null>;
    fetchStats: () => Promise<DoctorDashboardStats | null>;
    // 고유 환자 리스트 (DoctorLayout에서 계산됨)
    uniquePatientCounts?: {
        waiting: number;
        inProgress: number;
        completed: number;
    };
}

const DoctorDataContext = createContext<DoctorDataContextType | undefined>(undefined);

export const DoctorDataProvider = ({
    children,
    value
}: {
    children: ReactNode;
    value: DoctorDataContextType;
}) => {
    return (
        <DoctorDataContext.Provider value={value}>
            {children}
        </DoctorDataContext.Provider>
    );
};

export const useDoctorData = () => {
    const context = useContext(DoctorDataContext);
    if (context === undefined) {
        throw new Error('useDoctorData must be used within a DoctorDataProvider');
    }
    return context;
};
