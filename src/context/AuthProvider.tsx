import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as googleAuth from '../lib/googleAuth';

interface AuthContextType {
  isConnected: boolean;
  email: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  connectError: string | null;
  clearConnectError: () => void;
  /** Can edit when online AND connected to Google */
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(googleAuth.isConnected);
  const [email, setEmailState] = useState(googleAuth.getStoredEmail() || '');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

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
    ['famplan_drive_family_file_id', 'famplan_drive_root_folder_id', 'famplan_drive_data_folder_id', 'famplan_drive_sync_status', 'famplan_drive_people_file_id', 'famplan_drive_appointments_file_id', 'famplan_drive_attachments_index_file_id', 'famplan_drive_sync_people', 'famplan_drive_sync_appointments', 'famplan_drive_sync_index'].forEach((k) => localStorage.removeItem(k));
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

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const canEdit = isConnected && isOnline;

  return (
    <AuthContext.Provider value={{ isConnected, email, connect, disconnect, connectError, clearConnectError, canEdit }}>
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
