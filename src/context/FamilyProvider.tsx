import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

const DEFAULT_SELECTION_COLOR = '#10b981';

interface FamilyContextType {
  familyDisplayName: string;
  familyPhoto: string | null;
  selectionColor: string;
  planFilterPersonIds: string[] | null;
  setFamilyDisplayName: (name: string) => void;
  setFamilyPhoto: (photo: string | null) => void;
  setSelectionColor: (color: string) => void;
  setPlanFilterPersonIds: (ids: string[] | null) => void;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

interface FamilyCache {
  familyDisplayName: string;
  familyPhoto: string | null;
  selectionColor?: string;
  planFilterPersonIds?: string[] | null;
}

const PLAN_FILTER_STORAGE_KEY = 'famplan_plan_filter_person_ids';

export const FamilyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cached = cacheGet<FamilyCache>(CACHE_KEYS.family);
  const [familyDisplayName, setFamilyDisplayNameState] = useState(() => cached?.familyDisplayName ?? '');
  const [familyPhoto, setFamilyPhotoState] = useState<string | null>(() => cached?.familyPhoto ?? null);
  const [selectionColor, setSelectionColorState] = useState(() => cached?.selectionColor ?? DEFAULT_SELECTION_COLOR);
  const [planFilterPersonIds, setPlanFilterPersonIdsState] = useState<string[] | null>(() => {
    const fromCache = cached?.planFilterPersonIds;
    if (fromCache !== undefined) return fromCache;
    try {
      const raw = localStorage.getItem(PLAN_FILTER_STORAGE_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length > 0 ? arr : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    cacheSet(CACHE_KEYS.family, { familyDisplayName, familyPhoto, selectionColor, planFilterPersonIds });
  }, [familyDisplayName, familyPhoto, selectionColor, planFilterPersonIds]);

  useEffect(() => {
    if (planFilterPersonIds === null || planFilterPersonIds.length === 0) {
      localStorage.removeItem(PLAN_FILTER_STORAGE_KEY);
    } else {
      localStorage.setItem(PLAN_FILTER_STORAGE_KEY, JSON.stringify(planFilterPersonIds));
    }
  }, [planFilterPersonIds]);

  const setFamilyDisplayName = (name: string) => setFamilyDisplayNameState(name);
  const setFamilyPhoto = (photo: string | null) => setFamilyPhotoState(photo);
  const setSelectionColor = (color: string) => setSelectionColorState(color);
  const setPlanFilterPersonIds = (ids: string[] | null) => setPlanFilterPersonIdsState(ids);

  return (
    <FamilyContext.Provider value={{ familyDisplayName, familyPhoto, selectionColor, planFilterPersonIds, setFamilyDisplayName, setFamilyPhoto, setSelectionColor, setPlanFilterPersonIds }}>
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
