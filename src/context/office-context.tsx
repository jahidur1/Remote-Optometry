
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useUser } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';

type OfficeContextType = {
  selectedOffice: string | null;
  setSelectedOffice: (officeId: string) => void;
  authorizedOffices: any[];
  isLoading: boolean;
};

const OfficeContext = createContext<OfficeContextType | undefined>(undefined);

export function OfficeProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: userLoading } = useUser();
  const db = useFirestore();
  const [selectedOffice, setSelectedOfficeState] = useState<string | null>(null);
  
  // Fetch only active offices for the registry
  const { data: allOffices, loading: officesLoading } = useCollection(
    query(collection(db, 'offices'), where('status', '==', 'Active'), orderBy('officeName', 'asc'))
  );

  const authorizedOffices = useMemo(() => {
    if (!profile || !allOffices) return [];
    
    if (profile.role === 'SUPER_ADMIN') return allOffices;
    
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return allOffices.filter(o => allowedIds.includes(o.officeId));
  }, [profile, allOffices]);

  useEffect(() => {
    if (!userLoading && !officesLoading && authorizedOffices.length > 0) {
      const saved = localStorage.getItem('roc_selected_office');
      const isValidSaved = authorizedOffices.some(o => o.officeId === saved);
      
      if (saved && isValidSaved) {
        setSelectedOfficeState(saved);
      } else {
        setSelectedOfficeState(authorizedOffices[0].officeId);
      }
    }
  }, [authorizedOffices, userLoading, officesLoading]);

  const setSelectedOffice = (officeId: string) => {
    if (authorizedOffices.some(o => o.officeId === officeId)) {
      setSelectedOfficeState(officeId);
      localStorage.setItem('roc_selected_office', officeId);
    }
  };

  return (
    <OfficeContext.Provider value={{ 
      selectedOffice, 
      setSelectedOffice, 
      authorizedOffices, 
      isLoading: userLoading || officesLoading 
    }}>
      {children}
    </OfficeContext.Provider>
  );
}

export function useOffice() {
  const context = useContext(OfficeContext);
  if (context === undefined) {
    throw new Error('useOffice must be used within an OfficeProvider');
  }
  return context;
}
