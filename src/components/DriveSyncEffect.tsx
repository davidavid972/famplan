/**
 * Syncs family data with Google Drive when connected.
 * - On mount + connected: ensure folders, load family.json, update FamilyProvider
 * - On Settings open: re-sync from Drive
 * - On family name/photo change: write family.json to Drive
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useFamily } from '../context/FamilyProvider';
import {
  driveEnsureFamPlanStructure,
  driveLoadFamily,
  driveWriteJson,
  type FamilyData,
} from '../lib/drive';
import { cacheSet, CACHE_KEYS } from '../lib/cache';

const FILE_ID_KEY = 'famplan_drive_family_file_id';
const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const SYNC_STATUS_KEY = 'famplan_drive_sync_status';

export function DriveSyncEffect() {
  const { isConnected } = useAuth();
  const { familyDisplayName, familyPhoto, setFamilyDisplayName, setFamilyPhoto } = useFamily();
  const location = useLocation();
  const fileIdRef = useRef<string | null>(null);
  const familyDataRef = useRef<FamilyData | null>(null);
  const isLoadingFromDriveRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const [syncTrigger, setSyncTrigger] = useState(0);

  useEffect(() => {
    const handler = () => setSyncTrigger((t) => t + 1);
    window.addEventListener('famplan-drive-sync-request', handler);
    return () => window.removeEventListener('famplan-drive-sync-request', handler);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      initialLoadDoneRef.current = false;
      return;
    }
    if (location.pathname !== '/settings') return;

    let cancelled = false;

    async function syncFromDrive() {
      try {
        isLoadingFromDriveRef.current = true;
        localStorage.setItem(SYNC_STATUS_KEY, '');
        const cachedRoot = localStorage.getItem(ROOT_FOLDER_KEY);
        const { rootFolderId, dataFolderId } = await driveEnsureFamPlanStructure(cachedRoot);
        if (cancelled) return;
        localStorage.setItem(ROOT_FOLDER_KEY, rootFolderId);
        localStorage.setItem(DATA_FOLDER_KEY, dataFolderId);
        const { data, fileId } = await driveLoadFamily(dataFolderId);
        if (cancelled) return;
        fileIdRef.current = fileId;
        familyDataRef.current = data;
        localStorage.setItem(FILE_ID_KEY, fileId);
        localStorage.setItem('famplan_family_id', data.familyId);
        if (data.calendarId) localStorage.setItem('famplan_calendar_id', data.calendarId);
        setFamilyDisplayName(data.familyDisplayName || '');
        setFamilyPhoto(data.familyPhoto ?? null);
        cacheSet(CACHE_KEYS.family, { familyDisplayName: data.familyDisplayName || '', familyPhoto: data.familyPhoto ?? null });
        localStorage.setItem(SYNC_STATUS_KEY, 'Success');
        window.dispatchEvent(new CustomEvent('famplan-drive-sync-done'));
      } catch (e) {
        console.warn('Drive sync load failed:', e);
        localStorage.setItem(SYNC_STATUS_KEY, `Error: ${e instanceof Error ? e.message : String(e)}`);
        window.dispatchEvent(new CustomEvent('famplan-drive-sync-done'));
      } finally {
        isLoadingFromDriveRef.current = false;
        initialLoadDoneRef.current = true;
      }
    }

    const stored = localStorage.getItem(FILE_ID_KEY);
    if (stored) fileIdRef.current = stored;
    syncFromDrive();

    return () => {
      cancelled = true;
    };
  }, [isConnected, location.pathname, setFamilyDisplayName, setFamilyPhoto, syncTrigger]);

  useEffect(() => {
    if (!isConnected || !fileIdRef.current || !initialLoadDoneRef.current) return;

    const fileId = fileIdRef.current;
    const prev = familyDataRef.current;
    const familyId = localStorage.getItem('famplan_family_id') || crypto.randomUUID();
    localStorage.setItem('famplan_family_id', familyId);
    const payload: FamilyData = {
      familyId,
      familyDisplayName,
      familyPhoto: familyPhoto || undefined,
      createdAt: prev?.createdAt ?? new Date().toISOString(),
      calendarId: prev?.calendarId ?? undefined,
    };

    const t = setTimeout(() => {
      driveWriteJson(fileId, payload).catch((e) => console.warn('Drive write failed:', e));
    }, 500);
    return () => clearTimeout(t);
  }, [isConnected, familyDisplayName, familyPhoto]);

  return null;
}
