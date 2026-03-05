import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

const DEFAULT_SELECTION_COLOR = '#10b981';

interface FamilyContextType {
  familyDisplayName: string;
  familyPhoto: string | null;
  selectionColor: string;
  setFamilyDisplayName: (name: string) => void;
  setFamilyPhoto: (photo: string | null) => void;
  setSelectionColor: (color: string) => void;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

interface FamilyCache {
  familyDisplayName: string;
  familyPhoto: string | null;
  selectionColor?: string;
}

export const FamilyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cached = cacheGet<FamilyCache>(CACHE_KEYS.family);
  const [familyDisplayName, setFamilyDisplayNameState] = useState(() => cached?.familyDisplayName ?? '');
  const [familyPhoto, setFamilyPhotoState] = useState<string | null>(() => cached?.familyPhoto ?? null);
  const [selectionColor, setSelectionColorState] = useState(() => cached?.selectionColor ?? DEFAULT_SELECTION_COLOR);

  useEffect(() => {
    cacheSet(CACHE_KEYS.family, { familyDisplayName, familyPhoto, selectionColor });
  }, [familyDisplayName, familyPhoto, selectionColor]);

  const setFamilyDisplayName = (name: string) => setFamilyDisplayNameState(name);
  const setFamilyPhoto = (photo: string | null) => setFamilyPhotoState(photo);
  const setSelectionColor = (color: string) => setSelectionColorState(color);

  return (
    <FamilyContext.Provider value={{ familyDisplayName, familyPhoto, selectionColor, setFamilyDisplayName, setFamilyPhoto, setSelectionColor }}>
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
