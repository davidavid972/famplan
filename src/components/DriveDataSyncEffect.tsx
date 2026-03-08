/**
 * Syncs people, appointments, attachments index with Google Drive when connected.
 * - On mount + connected: ensure folders, load people.json, appointments.json, attachments_index.json
 * - Updates DataProvider via syncFromDrive
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import {
  driveEnsureFamPlanStructure,
  driveLoadPeople,
  driveLoadAppointments,
  driveLoadAttachmentsIndex,
} from '../lib/drive';
import { cacheGet, cacheGetPeopleFallback, CACHE_KEYS } from '../lib/cache';
import { validateAppointments } from '../lib/validateAppointments';
import type { Person, Appointment, Attachment } from '../types/models';

const PEOPLE_FILE_ID_KEY = 'famplan_drive_people_file_id';
const APPOINTMENTS_FILE_ID_KEY = 'famplan_drive_appointments_file_id';
const ATTACHMENTS_INDEX_FILE_ID_KEY = 'famplan_drive_attachments_index_file_id';
const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const PEOPLE_PHOTOS_FOLDER_KEY = 'famplan_drive_people_photos_folder_id';
const SYNC_PEOPLE_KEY = 'famplan_drive_sync_people';
const SYNC_APPOINTMENTS_KEY = 'famplan_drive_sync_appointments';
const SYNC_INDEX_KEY = 'famplan_drive_sync_index';

export function DriveDataSyncEffect() {
  const { isConnected } = useAuth();
  const { syncFromDrive, setSyncError } = useData();
  const location = useLocation();
  const hasRunRef = useRef(false);
  const [syncTrigger, setSyncTrigger] = useState(0);

  useEffect(() => {
    const handler = () => {
      hasRunRef.current = false;
      setSyncTrigger((t) => t + 1);
    };
    window.addEventListener('famplan-drive-sync-request', handler);
    return () => window.removeEventListener('famplan-drive-sync-request', handler);
  }, []);

  // Periodic refresh for multi-device sync (every 20s when connected)
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      hasRunRef.current = false;
      setSyncTrigger((t) => t + 1);
    }, 20000);
    return () => clearInterval(interval);
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) {
      hasRunRef.current = false;
      return;
    }
    // Load on mount, or re-load when opening Settings/People (cross-device refresh, ensure people_photos), or manual Sync now
    const shouldLoad = !hasRunRef.current || location.pathname === '/settings' || location.pathname === '/people';

    if (!shouldLoad) return;

    let cancelled = false;

    async function loadFromDrive() {
      try {
        // Show cache/fallback immediately for fast UI (never overwrite with empty on failure)
        const cachedPeople = cacheGet<Person[]>(CACHE_KEYS.people) ?? cacheGetPeopleFallback() as Person[] | null;
        const cachedAppointments = cacheGet<Appointment[]>(CACHE_KEYS.appointments);
        const cachedIndex = cacheGet<Attachment[]>(CACHE_KEYS.attachments_index);
        if (cachedPeople || cachedAppointments || cachedIndex) {
          syncFromDrive({
            people: Array.isArray(cachedPeople) ? cachedPeople : [],
            appointments: validateAppointments(cachedAppointments ?? []),
            attachments: Array.isArray(cachedIndex) ? cachedIndex : [],
          });
        }

        const cachedRoot = localStorage.getItem(ROOT_FOLDER_KEY);
        const { rootFolderId, dataFolderId, peoplePhotosFolderId, profilePhotosFolderId } = await driveEnsureFamPlanStructure(cachedRoot);
        if (cancelled) return;
        localStorage.setItem(ROOT_FOLDER_KEY, rootFolderId);
        localStorage.setItem(DATA_FOLDER_KEY, dataFolderId);
        localStorage.setItem(PEOPLE_PHOTOS_FOLDER_KEY, peoplePhotosFolderId);
        window.dispatchEvent(new CustomEvent('famplan-drive-data-folder-ready', { detail: { dataFolderId } }));
        localStorage.setItem('famplan_drive_profile_photos_folder_id', profilePhotosFolderId);

        const cachedPeopleId = localStorage.getItem(PEOPLE_FILE_ID_KEY);
        const cachedAppointmentsId = localStorage.getItem(APPOINTMENTS_FILE_ID_KEY);
        const cachedIndexId = localStorage.getItem(ATTACHMENTS_INDEX_FILE_ID_KEY);

        const [peopleRes, appointmentsRes, indexRes] = await Promise.all([
          driveLoadPeople(dataFolderId, cachedPeopleId),
          driveLoadAppointments(dataFolderId, cachedAppointmentsId),
          driveLoadAttachmentsIndex(dataFolderId, cachedIndexId),
        ]);

        if (cancelled) return;

        syncFromDrive(
          {
            people: Array.isArray(peopleRes.data.people) ? peopleRes.data.people : [],
            appointments: validateAppointments(appointmentsRes.data.appointments ?? []),
            attachments: Array.isArray(indexRes.data.items) ? indexRes.data.items : [],
          },
          {
            people: peopleRes.fileId,
            appointments: appointmentsRes.fileId,
            index: indexRes.fileId,
            dataFolderId,
            peopleVersion: peopleRes.data.version,
          }
        );
        const now = new Date().toISOString();
        localStorage.setItem(SYNC_PEOPLE_KEY, now);
        localStorage.setItem(SYNC_APPOINTMENTS_KEY, now);
        localStorage.setItem(SYNC_INDEX_KEY, now);
        hasRunRef.current = true;
        window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
      } catch (e) {
        console.warn('Drive data sync load failed:', e);
        if (!cancelled) {
          setSyncError('sync_error_load');
        }
      }
    }

    loadFromDrive();

    return () => {
      cancelled = true;
    };
  }, [isConnected, syncFromDrive, location.pathname, syncTrigger]);

  return null;
}
