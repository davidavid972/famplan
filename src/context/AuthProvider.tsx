import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as googleAuth from '../lib/googleAuth';

interface AuthContextType {
  isConnected: boolean;
  email: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  connectError: string | null;
  clearConnectError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(googleAuth.isConnected);
  const [email, setEmailState] = useState(googleAuth.getStoredEmail() || '');
  const [connectError, setConnectError] = useState<string | null>(null);

  const connect = async () => {
    setConnectError(null);
    try {
      const userEmail = await googleAuth.connectGoogle();
      setIsConnected(true);
      setEmailState(userEmail);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Connection failed');
    }
  };

  const disconnect = () => {
    googleAuth.clearGoogleSession();
    setIsConnected(false);
    setEmailState('');
    setConnectError(null);
  };

  const clearConnectError = () => setConnectError(null);

  useEffect(() => {
    const check = () => {
      const connected = googleAuth.isConnected();
      const storedEmail = googleAuth.getStoredEmail();
      setIsConnected(connected);
      setEmailState(storedEmail || '');
    };
    check();
  }, []);

  return (
    <AuthContext.Provider value={{ isConnected, email, connect, disconnect, connectError, clearConnectError }}>
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
