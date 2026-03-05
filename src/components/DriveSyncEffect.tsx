/**
 * Syncs family data with Google Drive when connected.
 * - On mount + connected: ensure folders, load family.json, update FamilyProvider
 * - On Settings open: re-sync from Drive
 * - On family name/photo change: write family.json to Drive
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useFamily } from '../context/FamilyProvider';
import {
  driveEnsureFamPlanStructure,
  driveLoadFamily,
  driveWriteJson,
  type FamilyData,
} from '../lib/drive';

const FILE_ID_KEY = 'famplan_drive_family_file_id';

export function DriveSyncEffect() {
  const { isConnected } = useAuth();
  const { familyDisplayName, familyPhoto, setFamilyDisplayName, setFamilyPhoto } = useFamily();
  const location = useLocation();
  const fileIdRef = useRef<string | null>(null);
  const isLoadingFromDriveRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

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
        const dataFolderId = await driveEnsureFamPlanStructure();
        const { data, fileId } = await driveLoadFamily(dataFolderId);
        if (cancelled) return;
        fileIdRef.current = fileId;
        localStorage.setItem(FILE_ID_KEY, fileId);
        localStorage.setItem('famplan_family_id', data.familyId);
        setFamilyDisplayName(data.familyDisplayName || '');
        setFamilyPhoto(data.familyPhoto ?? null);
      } catch (e) {
        console.warn('Drive sync load failed:', e);
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
  }, [isConnected, location.pathname, setFamilyDisplayName, setFamilyPhoto]);

  useEffect(() => {
    if (!isConnected || !fileIdRef.current || !initialLoadDoneRef.current) return;

    const fileId = fileIdRef.current;
    const familyId = localStorage.getItem('famplan_family_id') || crypto.randomUUID();
    localStorage.setItem('famplan_family_id', familyId);
    const payload: FamilyData = {
      familyId,
      familyDisplayName,
      familyPhoto: familyPhoto || undefined,
      createdAt: new Date().toISOString(),
    };

    const t = setTimeout(() => {
      driveWriteJson(fileId, payload).catch((e) => console.warn('Drive write failed:', e));
    }, 500);
    return () => clearTimeout(t);
  }, [isConnected, familyDisplayName, familyPhoto]);

  return null;
}
