/**
 * Tracks whether there are new activity log entries since last view.
 * Used for badge on Settings nav.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { auditLogLoad } from '../lib/auditLog';

const ACTIVITY_LAST_VIEWED_KEY = 'famplan_activity_last_viewed';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';

interface ActivityContextType {
  hasNewActivity: boolean;
  clearBadge: () => void;
  refreshBadge: () => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected } = useAuth();
  const [hasNewActivity, setHasNewActivity] = useState(false);

  const refreshBadge = useCallback(() => {
    if (!isConnected) return;
    const dataFolderId = localStorage.getItem(DATA_FOLDER_KEY);
    if (!dataFolderId) return;
    auditLogLoad(dataFolderId)
      .then(({ data }) => {
        const latest = data.entries[data.entries.length - 1]?.ts;
        if (latest) {
          const lastViewed = localStorage.getItem(ACTIVITY_LAST_VIEWED_KEY) || '0';
          setHasNewActivity(latest > lastViewed);
        }
      })
      .catch(() => {});
  }, [isConnected]);

  const clearBadge = useCallback(() => {
    setHasNewActivity(false);
  }, []);

  useEffect(() => {
    if (isConnected) refreshBadge();
  }, [isConnected, refreshBadge]);

  useEffect(() => {
    const handler = () => refreshBadge();
    window.addEventListener('famplan-drive-data-sync-done', handler);
    return () => window.removeEventListener('famplan-drive-data-sync-done', handler);
  }, [refreshBadge]);

  return (
    <ActivityContext.Provider value={{ hasNewActivity, clearBadge, refreshBadge }}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider');
  return ctx;
};
