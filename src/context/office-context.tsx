
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
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
  
  // Resilient Fetching: Stable query reference to prevent infinite loops
  const officesQuery = useMemo(() => query(collection(db, 'offices')), [db]);
  const { data: rawOffices, loading: officesLoading } = useCollection(officesQuery);

  const authorizedOffices = useMemo(() => {
    if (!profile || !rawOffices) return [];
    
    const activeOffices = rawOffices
      .filter(o => o.status === 'Active')
      .sort((a, b) => (a.officeName || '').localeCompare(b.officeName || ''));

    if (profile.role === 'super_admin') return activeOffices;
    
    const allowedIds = profile.officeIds || (profile.office ? [profile.office] : []);
    return activeOffices.filter(o => allowedIds.includes(o.officeId));
  }, [profile, rawOffices]);

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
