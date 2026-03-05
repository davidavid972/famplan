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
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';
import type { Person, Appointment, Attachment } from '../types/models';

const PEOPLE_FILE_ID_KEY = 'famplan_drive_people_file_id';
const APPOINTMENTS_FILE_ID_KEY = 'famplan_drive_appointments_file_id';
const ATTACHMENTS_INDEX_FILE_ID_KEY = 'famplan_drive_attachments_index_file_id';
const ROOT_FOLDER_KEY = 'famplan_drive_root_folder_id';
const PEOPLE_PHOTOS_FOLDER_KEY = 'famplan_drive_people_photos_folder_id';
const SYNC_PEOPLE_KEY = 'famplan_drive_sync_people';
const SYNC_APPOINTMENTS_KEY = 'famplan_drive_sync_appointments';
const SYNC_INDEX_KEY = 'famplan_drive_sync_index';

export function DriveDataSyncEffect() {
  const { isConnected } = useAuth();
  const { syncFromDrive } = useData();
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

  useEffect(() => {
    if (!isConnected) {
      hasRunRef.current = false;
      return;
    }
    // Load on mount, or re-load when opening Settings (cross-device refresh), or manual Sync now
    const shouldLoad = !hasRunRef.current || location.pathname === '/settings';

    if (!shouldLoad) return;

    let cancelled = false;

    async function loadFromDrive() {
      try {
        // Show cache immediately for fast UI
        const cachedPeople = cacheGet<Person[]>(CACHE_KEYS.people);
        const cachedAppointments = cacheGet<Appointment[]>(CACHE_KEYS.appointments);
        const cachedIndex = cacheGet<Attachment[]>(CACHE_KEYS.attachments_index);
        if (cachedPeople || cachedAppointments || cachedIndex) {
          syncFromDrive({
            people: cachedPeople ?? [],
            appointments: cachedAppointments ?? [],
            attachments: cachedIndex ?? [],
          });
        }

        const cachedRoot = localStorage.getItem(ROOT_FOLDER_KEY);
        const { rootFolderId, dataFolderId, peoplePhotosFolderId } = await driveEnsureFamPlanStructure(cachedRoot);
        if (cancelled) return;
        localStorage.setItem(ROOT_FOLDER_KEY, rootFolderId);
        localStorage.setItem(PEOPLE_PHOTOS_FOLDER_KEY, peoplePhotosFolderId);

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
            people: peopleRes.data.people,
            appointments: appointmentsRes.data.appointments,
            attachments: indexRes.data.items,
          },
          {
            people: peopleRes.fileId,
            appointments: appointmentsRes.fileId,
            index: indexRes.fileId,
            dataFolderId,
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
      }
    }

    loadFromDrive();

    return () => {
      cancelled = true;
    };
  }, [isConnected, syncFromDrive, location.pathname, syncTrigger]);

  return null;
}
