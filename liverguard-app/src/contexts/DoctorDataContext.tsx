import { createContext, useContext, type ReactNode } from 'react';
import type { WaitingQueueResponse, DoctorDashboardStats } from '../api/doctorApi';

interface DoctorDataContextType {
    waitingQueueData: WaitingQueueResponse | null;
    stats: DoctorDashboardStats;
    fetchWaitingQueue: () => Promise<WaitingQueueResponse | null>;
    fetchStats: () => Promise<DoctorDashboardStats | null>;
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
