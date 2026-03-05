import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

interface FamilyContextType {
  familyDisplayName: string;
  familyPhoto: string | null;
  setFamilyDisplayName: (name: string) => void;
  setFamilyPhoto: (photo: string | null) => void;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

interface FamilyCache {
  familyDisplayName: string;
  familyPhoto: string | null;
}

export const FamilyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cached = cacheGet<FamilyCache>(CACHE_KEYS.family);
  const [familyDisplayName, setFamilyDisplayNameState] = useState(() => cached?.familyDisplayName ?? '');
  const [familyPhoto, setFamilyPhotoState] = useState<string | null>(() => cached?.familyPhoto ?? null);

  useEffect(() => {
    cacheSet(CACHE_KEYS.family, { familyDisplayName, familyPhoto });
  }, [familyDisplayName, familyPhoto]);

  const setFamilyDisplayName = (name: string) => setFamilyDisplayNameState(name);
  const setFamilyPhoto = (photo: string | null) => setFamilyPhotoState(photo);

  return (
    <FamilyContext.Provider value={{ familyDisplayName, familyPhoto, setFamilyDisplayName, setFamilyPhoto }}>
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = () => {
  const context = useContext(FamilyContext);
  if (!context) {
    throw new Error('useFamily must be used within a FamilyProvider');
  }
  return context;
};
