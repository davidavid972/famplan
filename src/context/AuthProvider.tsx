import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'famplan_google_connected';
const EMAIL_KEY = 'famplan_user_email';
const MOCK_EMAIL = 'user@gmail.com';

interface AuthContextType {
  isConnected: boolean;
  email: string;
  connect: (email?: string) => void;
  disconnect: () => void;
  setEmail: (email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadConnected = (): boolean => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'true';
};

const loadEmail = (): string => {
  const saved = localStorage.getItem(EMAIL_KEY);
  return saved || MOCK_EMAIL;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(loadConnected);
  const [email, setEmailState] = useState(loadEmail);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isConnected));
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      localStorage.setItem(EMAIL_KEY, email);
    }
  }, [isConnected, email]);

  const connect = (userEmail?: string) => {
    setIsConnected(true);
    setEmailState(userEmail?.trim() || MOCK_EMAIL);
  };

  const disconnect = () => {
    setIsConnected(false);
    setEmailState(MOCK_EMAIL);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EMAIL_KEY);
  };

  const setEmail = (newEmail: string) => {
    setEmailState(newEmail);
  };

  return (
    <AuthContext.Provider value={{ isConnected, email, connect, disconnect, setEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
