import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const NAME_KEY = 'famplan_family_display_name';
const PHOTO_KEY = 'famplan_family_photo';

interface FamilyContextType {
  familyDisplayName: string;
  familyPhoto: string | null;
  setFamilyDisplayName: (name: string) => void;
  setFamilyPhoto: (photo: string | null) => void;
}

const FamilyContext = createContext<FamilyContextType | undefined>(undefined);

const load = (key: string): string | null => {
  return localStorage.getItem(key);
};

export const FamilyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [familyDisplayName, setFamilyDisplayNameState] = useState(() => load(NAME_KEY) || '');
  const [familyPhoto, setFamilyPhotoState] = useState<string | null>(() => load(PHOTO_KEY));

  useEffect(() => {
    localStorage.setItem(NAME_KEY, familyDisplayName);
  }, [familyDisplayName]);

  useEffect(() => {
    if (familyPhoto) {
      localStorage.setItem(PHOTO_KEY, familyPhoto);
    } else {
      localStorage.removeItem(PHOTO_KEY);
    }
  }, [familyPhoto]);

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
