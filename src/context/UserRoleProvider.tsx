/**
 * Provides current user role and members from users.json.
 * - Loads users.json when connected
 * - If empty, adds current user as admin (creator)
 * - canEdit = (isConnected && isOnline) && (role === 'admin' || role === 'editor')
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as googleAuth from '../lib/googleAuth';
import {
  driveEnsureFamPlanStructure,
  driveLoadUsers,
  driveWriteUsers,
  driveCreatePermission,
  driveDeletePermission,
  driveUpdatePermission,
  driveListPermissions,
  type UsersData,
  type UsersDataMember,
  type UserRoleType,
  type DrivePermissionRole,
} from '../lib/drive';

const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const USERS_FILE_ID_KEY = 'famplan_drive_users_file_id';

interface UserRoleContextType {
  userRole: UserRoleType | null;
  members: UsersDataMember[];
  isLoading: boolean;
  refreshMembers: () => Promise<void>;
  addMember: (email: string, role: 'viewer' | 'editor') => Promise<void>;
  removeMember: (email: string) => Promise<void>;
  updateMemberRole: (email: string, role: 'viewer' | 'editor') => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

function roleToDriveRole(role: 'viewer' | 'editor'): DrivePermissionRole {
  return role === 'viewer' ? 'reader' : 'writer';
}

export const UserRoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRoleType | null>(null);
  const [members, setMembers] = useState<UsersDataMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMembers = useCallback(async () => {
    const email = googleAuth.getStoredEmail();
    if (!email || !googleAuth.isConnected()) {
      setUserRole(null);
      setMembers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const cachedRoot = localStorage.getItem(ROOT_FOLDER_KEY);
      const { rootFolderId, dataFolderId } = await driveEnsureFamPlanStructure(cachedRoot);
      localStorage.setItem(ROOT_FOLDER_KEY, rootFolderId);
      const cachedUsersId = localStorage.getItem(USERS_FILE_ID_KEY);
      const { data, fileId } = await driveLoadUsers(dataFolderId, cachedUsersId);
      localStorage.setItem(USERS_FILE_ID_KEY, fileId);
      localStorage.setItem(DATA_FOLDER_KEY, dataFolderId);

      let usersData = data;
      const existing = data.members.find((m) => m.email.toLowerCase() === email.toLowerCase());
      if (!existing) {
        // Creator: add as admin and persist
        const newMember: UsersDataMember = {
          email,
          role: 'admin',
          addedAt: new Date().toISOString(),
        };
        usersData = {
          ...data,
          version: 1,
          updatedAt: new Date().toISOString(),
          members: [...data.members, newMember],
        };
        await driveWriteUsers(fileId, usersData);
      }

      const me = usersData.members.find((m) => m.email.toLowerCase() === email.toLowerCase());
      setUserRole(me?.role ?? 'admin');
      setMembers(usersData.members);
    } catch (e) {
      console.warn('UserRole load failed:', e);
      setUserRole('admin');
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!googleAuth.isConnected()) {
      setUserRole(null);
      setMembers([]);
      setIsLoading(false);
      return;
    }
    refreshMembers();
  }, [refreshMembers]);

  useEffect(() => {
    const handler = () => refreshMembers();
    window.addEventListener('famplan-auth-connected', handler);
    return () => window.removeEventListener('famplan-auth-connected', handler);
  }, [refreshMembers]);

  const addMember = useCallback(
    async (email: string, role: 'viewer' | 'editor') => {
      const rootFolderId = localStorage.getItem(ROOT_FOLDER_KEY);
      const dataFolderId = localStorage.getItem(DATA_FOLDER_KEY);
      const usersFileId = localStorage.getItem(USERS_FILE_ID_KEY);
      if (!rootFolderId || !dataFolderId || !usersFileId) {
        const cachedRoot = localStorage.getItem(ROOT_FOLDER_KEY);
        const { rootFolderId: r, dataFolderId: d } = await driveEnsureFamPlanStructure(cachedRoot);
        localStorage.setItem(ROOT_FOLDER_KEY, r);
        localStorage.setItem(DATA_FOLDER_KEY, d);
        const { data, fileId } = await driveLoadUsers(d, null);
        localStorage.setItem(USERS_FILE_ID_KEY, fileId);
        throw new Error('Please try again');
      }
      const { data, fileId } = await driveLoadUsers(dataFolderId, usersFileId);
      const normalized = email.trim().toLowerCase();
      if (data.members.some((m) => m.email.toLowerCase() === normalized)) {
        throw new Error('Member already invited');
      }
      const driveRole = roleToDriveRole(role);
      const { id: permissionId } = await driveCreatePermission(rootFolderId, email.trim(), driveRole);
      const newMember: UsersDataMember = {
        email: email.trim(),
        role,
        addedAt: new Date().toISOString(),
        permissionId,
      };
      const updated: UsersData = {
        ...data,
        updatedAt: new Date().toISOString(),
        members: [...data.members, newMember],
      };
      await driveWriteUsers(fileId, updated);
      await refreshMembers();
    },
    [refreshMembers]
  );

  const removeMember = useCallback(
    async (email: string) => {
      const currentEmail = googleAuth.getStoredEmail();
      if (currentEmail && email.toLowerCase() === currentEmail.toLowerCase()) {
        throw new Error('Cannot remove yourself');
      }
      const rootFolderId = localStorage.getItem(ROOT_FOLDER_KEY);
      const dataFolderId = localStorage.getItem(DATA_FOLDER_KEY);
      const usersFileId = localStorage.getItem(USERS_FILE_ID_KEY);
      if (!rootFolderId || !dataFolderId || !usersFileId) throw new Error('Not ready');
      const { data, fileId } = await driveLoadUsers(dataFolderId, usersFileId);
      const normalized = email.toLowerCase();
      const member = data.members.find((m) => m.email.toLowerCase() === normalized);
      if (!member) return;
      if (member.permissionId) {
        await driveDeletePermission(rootFolderId, member.permissionId);
      }
      // Creator (no permissionId) cannot be removed - they own the folder
      const updated: UsersData = {
        ...data,
        updatedAt: new Date().toISOString(),
        members: data.members.filter((m) => m.email.toLowerCase() !== normalized),
      };
      await driveWriteUsers(fileId, updated);
      await refreshMembers();
    },
    [refreshMembers]
  );

  const updateMemberRole = useCallback(
    async (email: string, role: 'viewer' | 'editor') => {
      const rootFolderId = localStorage.getItem(ROOT_FOLDER_KEY);
      const dataFolderId = localStorage.getItem(DATA_FOLDER_KEY);
      const usersFileId = localStorage.getItem(USERS_FILE_ID_KEY);
      if (!rootFolderId || !dataFolderId || !usersFileId) throw new Error('Not ready');
      const { data, fileId } = await driveLoadUsers(dataFolderId, usersFileId);
      const normalized = email.toLowerCase();
      const member = data.members.find((m) => m.email.toLowerCase() === normalized);
      if (!member) return;
      if (member.permissionId) {
        await driveUpdatePermission(rootFolderId, member.permissionId, roleToDriveRole(role));
      }
      const updated: UsersData = {
        ...data,
        updatedAt: new Date().toISOString(),
        members: data.members.map((m) =>
          m.email.toLowerCase() === normalized ? { ...m, role } : m
        ),
      };
      await driveWriteUsers(fileId, updated);
      await refreshMembers();
    },
    [refreshMembers]
  );

  return (
    <UserRoleContext.Provider value={{ userRole, members, isLoading, refreshMembers, addMember, removeMember, updateMemberRole }}>
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const ctx = useContext(UserRoleContext);
  if (!ctx) throw new Error('useUserRole must be used within UserRoleProvider');
  return ctx;
};
