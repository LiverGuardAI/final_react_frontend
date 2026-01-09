import { createContext, useContext, useState, type ReactNode } from 'react';

interface TreatmentContextType {
  selectedEncounterId: number | null;
  setSelectedEncounterId: (id: number | null) => void;
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
}

const TreatmentContext = createContext<TreatmentContextType | undefined>(undefined);

export const TreatmentProvider = ({ children }: { children: ReactNode }) => {
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  return (
    <TreatmentContext.Provider value={{
      selectedEncounterId,
      setSelectedEncounterId,
      selectedPatientId,
      setSelectedPatientId
    }}>
      {children}
    </TreatmentContext.Provider>
  );
};

export const useTreatment = () => {
  const context = useContext(TreatmentContext);
  if (context === undefined) {
    throw new Error('useTreatment must be used within a TreatmentProvider');
  }
  return context;
};
