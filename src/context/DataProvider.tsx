import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Person, Appointment, Attachment } from '../types/models';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthProvider';
import {
  driveEnsureFamPlanStructure,
  driveLoadPeople,
  driveLoadAppointments,
  driveLoadAttachmentsIndex,
  driveWriteJson,
  driveReadJson,
  type PeopleData,
  type AppointmentsData,
  type AttachmentsIndexData,
} from '../lib/drive';
import {
  ensureFamPlanCalendar,
  createEvent,
  updateEvent,
  deleteEvent,
  planToEventPayload,
} from '../lib/calendar';
import { cacheGet, cacheSet, cacheGetPeopleFallback, cacheSetPeopleFallback, CACHE_KEYS } from '../lib/cache';
import { validateAppointments } from '../lib/validateAppointments';
import { auditLogAppend } from '../lib/auditLog';

const PEOPLE_FILE_ID_KEY = 'famplan_drive_people_file_id';
const APPOINTMENTS_FILE_ID_KEY = 'famplan_drive_appointments_file_id';
const ATTACHMENTS_INDEX_FILE_ID_KEY = 'famplan_drive_attachments_index_file_id';
const DATA_FOLDER_KEY = 'famplan_drive_data_folder_id';
const SYNC_PEOPLE_KEY = 'famplan_drive_sync_people';
const SYNC_APPOINTMENTS_KEY = 'famplan_drive_sync_appointments';
const SYNC_INDEX_KEY = 'famplan_drive_sync_index';

interface DataContextType {
  people: Person[];
  appointments: Appointment[];
  attachments: Attachment[];
  syncError: string | null;
  /** 'drive' = from Drive sync, 'cache' = from local cache/initial load */
  lastSyncSource: 'drive' | 'cache' | null;
  syncCalendarToGoogle: () => Promise<{ synced: number; created: number; failed: number }>;
  addPerson: (person: Omit<Person, 'id' | 'createdAt'>) => Person;
  updatePerson: (id: string, person: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'> & { recurrenceGroupId?: string | null }) => Promise<Appointment>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  deleteAppointments: (ids: string[]) => Promise<void>;
  deleteAppointmentsByRecurrenceGroupId: (groupId: string) => Promise<void>;
  addAttachment: (attachment: Omit<Attachment, 'id' | 'createdAt'>) => void;
  deleteAttachment: (id: string) => void;
  deleteAttachments: (ids: string[]) => void;
  syncFromDrive: (data: { people: Person[]; appointments: Appointment[]; attachments: Attachment[] }, fileIds?: { people: string; appointments: string; index: string; dataFolderId: string; peopleVersion?: number }) => void;
  setSyncError: (err: string | null) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const loadFromCache = <T,>(cacheKey: string, defaultValue: T[]): T[] => {
  const cached = cacheGet<T[]>(cacheKey);
  if (cached != null && Array.isArray(cached)) return cached;
  if (cacheKey === CACHE_KEYS.people) {
    const fallback = cacheGetPeopleFallback();
    if (fallback != null && Array.isArray(fallback) && fallback.length > 0) return fallback as T[];
  }
  return defaultValue;
};

const loadAppointmentsFromCache = (): Appointment[] => {
  const cached = cacheGet<Appointment[]>(CACHE_KEYS.appointments);
  return validateAppointments(cached ?? []);
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isConnected, canEdit, email } = useAuth();
  const [people, setPeople] = useState<Person[]>(() => loadFromCache(CACHE_KEYS.people, []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadAppointmentsFromCache());
  const [attachments, setAttachments] = useState<Attachment[]>(() => loadFromCache(CACHE_KEYS.attachments_index, []));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncSource, setLastSyncSource] = useState<'drive' | 'cache' | null>(null);
  const peopleFileIdRef = useRef<string | null>(null);
  const appointmentsFileIdRef = useRef<string | null>(null);
  const indexFileIdRef = useRef<string | null>(null);
  const dataFolderIdRef = useRef<string | null>(null);
  const peopleVersionRef = useRef<number>(1);
  const initialDriveLoadDoneRef = useRef(false);
  const skipNextDriveWriteRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      initialDriveLoadDoneRef.current = false;
      setPeople([]);
      setAppointments([]);
      setAttachments([]);
      setLastSyncSource(null);
      return;
    }
    peopleFileIdRef.current = localStorage.getItem(PEOPLE_FILE_ID_KEY);
    appointmentsFileIdRef.current = localStorage.getItem(APPOINTMENTS_FILE_ID_KEY);
    indexFileIdRef.current = localStorage.getItem(ATTACHMENTS_INDEX_FILE_ID_KEY);
    dataFolderIdRef.current = localStorage.getItem(DATA_FOLDER_KEY);
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    const handler = (e: Event) => {
      const { dataFolderId } = (e as CustomEvent).detail || {};
      if (dataFolderId) dataFolderIdRef.current = dataFolderId;
    };
    window.addEventListener('famplan-drive-data-folder-ready', handler);
    return () => window.removeEventListener('famplan-drive-data-folder-ready', handler);
  }, [isConnected]);

  const syncFromDrive = useCallback((data: { people: Person[]; appointments: Appointment[]; attachments: Attachment[] }, fileIds?: { people: string; appointments: string; index: string; dataFolderId: string }) => {
    setSyncError(null);
    skipNextDriveWriteRef.current = true;
    setPeople(Array.isArray(data.people) ? data.people : []);
    setAppointments(validateAppointments(data.appointments ?? []));
    setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
    setLastSyncSource(fileIds ? 'drive' : 'cache');
    if (fileIds) {
      peopleFileIdRef.current = fileIds.people;
      appointmentsFileIdRef.current = fileIds.appointments;
      indexFileIdRef.current = fileIds.index;
      dataFolderIdRef.current = fileIds.dataFolderId;
      if (fileIds.peopleVersion != null) {
        if (initialDriveLoadDoneRef.current && fileIds.peopleVersion > peopleVersionRef.current) {
          window.dispatchEvent(new CustomEvent('famplan-remote-changes'));
        }
        peopleVersionRef.current = fileIds.peopleVersion;
      }
      initialDriveLoadDoneRef.current = true;
      localStorage.setItem(PEOPLE_FILE_ID_KEY, fileIds.people);
      localStorage.setItem(APPOINTMENTS_FILE_ID_KEY, fileIds.appointments);
      localStorage.setItem(ATTACHMENTS_INDEX_FILE_ID_KEY, fileIds.index);
      localStorage.setItem(DATA_FOLDER_KEY, fileIds.dataFolderId);
      if (Array.isArray(data.people) && data.people.length > 0) {
        cacheSetPeopleFallback(data.people);
      }
    }
  }, []);

  // Update cache when data changes (cache is TTL-based, not persistent source)
  useEffect(() => {
    cacheSet(CACHE_KEYS.people, people);
  }, [people]);

  useEffect(() => {
    cacheSet(CACHE_KEYS.appointments, appointments);
  }, [appointments]);

  useEffect(() => {
    cacheSet(CACHE_KEYS.attachments_index, attachments);
  }, [attachments]);

  // Write to Drive when connected (debounced). Skip when data came from Drive load.
  useEffect(() => {
    if (!isConnected || !dataFolderIdRef.current || !initialDriveLoadDoneRef.current) return;
    if (skipNextDriveWriteRef.current) {
      skipNextDriveWriteRef.current = false;
      return;
    }
    const pid = peopleFileIdRef.current;
    const aid = appointmentsFileIdRef.current;
    const iid = indexFileIdRef.current;
    if (!pid || !aid || !iid) return;

    const t = setTimeout(() => {
      const now = new Date().toISOString();
      const appointmentsPayload: AppointmentsData = { version: 1, updatedAt: now, appointments };
      const indexPayload: AttachmentsIndexData = { version: 1, updatedAt: now, items: attachments, freeLimit: 20 };
      driveReadJson<PeopleData>(pid)
        .then((remote) => {
          const newVersion = (remote.version ?? 1) + 1;
          const peoplePayload: PeopleData = {
            version: newVersion,
            updatedAt: now,
            updatedBy: email || undefined,
            people,
          };
          return driveWriteJson(pid, peoplePayload).then((id) => {
            peopleVersionRef.current = newVersion;
            return id;
          });
        })
        .catch(() => {
          const peoplePayload: PeopleData = { version: 1, updatedAt: now, updatedBy: email || undefined, people };
          return driveWriteJson(pid, peoplePayload).then((id) => {
            peopleVersionRef.current = 1;
            return id;
          });
        })
        .then(() => {
          localStorage.setItem(SYNC_PEOPLE_KEY, now);
          window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          window.dispatchEvent(new CustomEvent('famplan-drive-write-error', { detail: { message: `People: ${msg}` } }));
        });
      driveWriteJson(aid, appointmentsPayload).then(() => {
        localStorage.setItem(SYNC_APPOINTMENTS_KEY, now);
        window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
      }).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        window.dispatchEvent(new CustomEvent('famplan-drive-write-error', { detail: { message: `Appointments: ${msg}` } }));
      });
      driveWriteJson(iid, indexPayload).then(() => {
        localStorage.setItem(SYNC_INDEX_KEY, now);
        window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
      }).catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        window.dispatchEvent(new CustomEvent('famplan-drive-write-error', { detail: { message: `Index: ${msg}` } }));
      });
    }, 500);
    return () => clearTimeout(t);
  }, [isConnected, people, appointments, attachments]);

  const addPerson = (person: Omit<Person, 'id' | 'createdAt'>): Person => {
    const newPerson: Person = {
      ...person,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    if (canEdit) {
      setPeople((prev) => [...prev, newPerson]);
      const df = dataFolderIdRef.current;
      if (df && email) {
        auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'people.add', entityId: newPerson.id, summary: newPerson.name }).catch(() => {});
      }
    }
    return newPerson;
  };

  const updatePerson = (id: string, data: Partial<Person>) => {
    if (!canEdit) return;
    const prev = people.find((p) => p.id === id);
    setPeople((prevP) => prevP.map((p) => (p.id === id ? { ...p, ...data } : p)));
    const df = dataFolderIdRef.current;
    if (df && email && prev) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'people.update', entityId: id, summary: data.name ?? prev.name }).catch(() => {});
    }
  };

  const deletePerson = (id: string) => {
    if (!canEdit) return;
    const prev = people.find((p) => p.id === id);
    setPeople((prevP) => prevP.filter((p) => p.id !== id));
    setAppointments((prevP) => prevP.filter((a) => a.personId !== id));
    const appointmentsToDelete = appointments.filter(a => a.personId === id).map(a => a.id);
    setAttachments((prevP) => prevP.filter((a) => !appointmentsToDelete.includes(a.appointmentId)));
    const df = dataFolderIdRef.current;
    if (df && email && prev) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'people.delete', entityId: id, summary: prev.name }).catch(() => {});
    }
  };

  const addAppointment = async (appointment: Omit<Appointment, 'id' | 'createdAt'>): Promise<Appointment> => {
    if (!canEdit) return { ...appointment, id: '', createdAt: 0 } as Appointment;
    const reminders = appointment.reminders !== undefined
      ? appointment.reminders
      : [{ minutesBeforeStart: 15 }];
    const newAppointment: Appointment = {
      ...appointment,
      reminders,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    try {
      const calendarId = await ensureFamPlanCalendar();
      const payload = planToEventPayload(newAppointment);
      const { id: eventId } = await createEvent(calendarId, payload);
      newAppointment.calendarEventId = eventId;
    } catch (e) {
      console.warn('[FamPlan] Calendar sync on add failed:', e);
    }
    setAppointments((prev) => [...prev, newAppointment]);
    const df = dataFolderIdRef.current;
    if (df && email) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'appointments.add', entityId: newAppointment.id, summary: newAppointment.title }).catch(() => {});
    }
    return newAppointment;
  };

  const updateAppointment = async (id: string, data: Partial<Appointment>) => {
    if (!canEdit) return;
    const prev = appointments.find((a) => a.id === id);
    if (!prev) return;
    const merged = { ...prev, ...data };
    let calendarEventId = merged.calendarEventId ?? prev.calendarEventId;
    try {
      const calendarId = await ensureFamPlanCalendar();
      const payload = planToEventPayload(merged);
      if (calendarEventId) {
        await updateEvent(calendarId, calendarEventId, payload);
      } else {
        const { id: eventId } = await createEvent(calendarId, payload);
        calendarEventId = eventId;
      }
    } catch (e) {
      console.warn('[FamPlan] Calendar sync on update failed:', e);
    }
    const finalData = calendarEventId ? { ...data, calendarEventId } : data;
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...finalData } : a)));
    const df = dataFolderIdRef.current;
    if (df && email && prev) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'appointments.update', entityId: id, summary: data.title ?? prev.title }).catch(() => {});
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!canEdit) return;
    const prev = appointments.find((a) => a.id === id);
    const df = dataFolderIdRef.current;
    if (df && email && prev) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'appointments.delete', entityId: id, summary: prev.title }).catch(() => {});
    }
    if (prev?.calendarEventId) {
      try {
        const calendarId = await ensureFamPlanCalendar();
        await deleteEvent(calendarId, prev.calendarEventId);
      } catch (e) {
        console.warn('[FamPlan] Calendar sync on delete failed:', e);
      }
    }
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setAttachments((prev) => prev.filter((a) => a.appointmentId !== id));
  };

  const deleteAppointmentsByRecurrenceGroupId = async (groupId: string) => {
    if (!canEdit) return;
    const toDelete = appointments.filter((a) => a.recurrenceGroupId === groupId);
    await deleteAppointments(toDelete.map((a) => a.id));
  };

  const deleteAppointments = async (ids: string[]) => {
    if (!canEdit || ids.length === 0) return;
    const idSet = new Set(ids);
    const toDelete = appointments.filter((a) => idSet.has(a.id));
    const df = dataFolderIdRef.current;
    for (const app of toDelete) {
      if (df && email) {
        auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'appointments.delete', entityId: app.id, summary: app.title }).catch(() => {});
      }
      if (app.calendarEventId) {
        try {
          const calendarId = await ensureFamPlanCalendar();
          await deleteEvent(calendarId, app.calendarEventId);
        } catch (e) {
          console.warn('[FamPlan] Calendar sync on delete failed:', e);
        }
      }
    }
    setAppointments((prev) => prev.filter((a) => !idSet.has(a.id)));
    setAttachments((prev) => prev.filter((a) => !idSet.has(a.appointmentId)));
  };

  const addAttachment = (attachment: Omit<Attachment, 'id' | 'createdAt'>) => {
    if (!canEdit) return;
    const newAttachment: Attachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setAttachments((prev) => [...prev, newAttachment]);
    const df = dataFolderIdRef.current;
    if (df && email) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'attachments.add', entityId: newAttachment.id, summary: newAttachment.name ?? newAttachment.id }).catch(() => {});
    }
  };

  const deleteAttachment = (id: string) => {
    if (!canEdit) return;
    const prev = attachments.find((a) => a.id === id);
    const df = dataFolderIdRef.current;
    if (df && email && prev) {
      auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'attachments.delete', entityId: id, summary: prev.name ?? id }).catch(() => {});
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const deleteAttachments = (ids: string[]) => {
    if (!canEdit) return;
    const df = dataFolderIdRef.current;
    if (df && email) {
      for (const id of ids) {
        const prev = attachments.find((a) => a.id === id);
        auditLogAppend(df, null, { ts: new Date().toISOString(), userEmail: email, action: 'attachments.delete', entityId: id, summary: prev?.name ?? id }).catch(() => {});
      }
    }
    setAttachments((prev) => prev.filter((a) => !ids.includes(a.id)));
  };

  const syncCalendarToGoogle = useCallback(async (): Promise<{ synced: number; created: number; failed: number }> => {
    const result = { synced: 0, created: 0, failed: 0 };
    if (!canEdit) return result;
    const updates: { id: string; calendarEventId: string }[] = [];
    try {
      const calendarId = await ensureFamPlanCalendar();
      for (const app of appointments) {
        try {
          const payload = planToEventPayload({
            title: app.title,
            start: app.start,
            end: app.end,
            location: app.location,
            notes: app.notes,
            reminders: app.reminders ?? [{ minutesBeforeStart: 15 }],
          });
          if (app.calendarEventId) {
            await updateEvent(calendarId, app.calendarEventId, payload);
            result.synced++;
          } else {
            const { id: eventId } = await createEvent(calendarId, payload);
            updates.push({ id: app.id, calendarEventId: eventId });
            result.created++;
          }
        } catch {
          result.failed++;
        }
      }
      if (updates.length > 0) {
        const updateMap = new Map(updates.map((u) => [u.id, u.calendarEventId]));
        setAppointments((prev) =>
          prev.map((a) => (updateMap.has(a.id) ? { ...a, calendarEventId: updateMap.get(a.id)! } : a))
        );
      }
    } catch {
      result.failed = appointments.length;
    }
    return result;
  }, [canEdit, appointments]);

  return (
    <DataContext.Provider
      value={{
        people,
        appointments,
        attachments,
        lastSyncSource,
        syncCalendarToGoogle,
        addPerson,
        updatePerson,
        deletePerson,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        deleteAppointments,
        deleteAppointmentsByRecurrenceGroupId,
        addAttachment,
        deleteAttachment,
        deleteAttachments,
        syncFromDrive,
        syncError,
        setSyncError,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
