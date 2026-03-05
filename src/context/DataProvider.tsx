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
import { cacheGet, cacheSet, CACHE_KEYS } from '../lib/cache';

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
  addPerson: (person: Omit<Person, 'id' | 'createdAt'>) => void;
  updatePerson: (id: string, person: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => Promise<Appointment>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  addAttachment: (attachment: Omit<Attachment, 'id' | 'createdAt'>) => void;
  deleteAttachment: (id: string) => void;
  deleteAttachments: (ids: string[]) => void;
  syncFromDrive: (data: { people: Person[]; appointments: Appointment[]; attachments: Attachment[] }, fileIds?: { people: string; appointments: string; index: string; dataFolderId: string }) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const loadFromCache = <T,>(cacheKey: string, defaultValue: T[]): T[] => {
  const cached = cacheGet<T[]>(cacheKey);
  return cached ?? defaultValue;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isConnected, canEdit } = useAuth();
  const [people, setPeople] = useState<Person[]>(() => loadFromCache(CACHE_KEYS.people, []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadFromCache(CACHE_KEYS.appointments, []));
  const [attachments, setAttachments] = useState<Attachment[]>(() => loadFromCache(CACHE_KEYS.attachments_index, []));
  const peopleFileIdRef = useRef<string | null>(null);
  const appointmentsFileIdRef = useRef<string | null>(null);
  const indexFileIdRef = useRef<string | null>(null);
  const dataFolderIdRef = useRef<string | null>(null);
  const initialDriveLoadDoneRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      initialDriveLoadDoneRef.current = false;
      return;
    }
    peopleFileIdRef.current = localStorage.getItem(PEOPLE_FILE_ID_KEY);
    appointmentsFileIdRef.current = localStorage.getItem(APPOINTMENTS_FILE_ID_KEY);
    indexFileIdRef.current = localStorage.getItem(ATTACHMENTS_INDEX_FILE_ID_KEY);
    dataFolderIdRef.current = localStorage.getItem(DATA_FOLDER_KEY);
  }, [isConnected]);

  const syncFromDrive = useCallback((data: { people: Person[]; appointments: Appointment[]; attachments: Attachment[] }, fileIds?: { people: string; appointments: string; index: string; dataFolderId: string }) => {
    setPeople(data.people);
    setAppointments(data.appointments);
    setAttachments(data.attachments);
    if (fileIds) {
      peopleFileIdRef.current = fileIds.people;
      appointmentsFileIdRef.current = fileIds.appointments;
      indexFileIdRef.current = fileIds.index;
      dataFolderIdRef.current = fileIds.dataFolderId;
      initialDriveLoadDoneRef.current = true;
      localStorage.setItem(PEOPLE_FILE_ID_KEY, fileIds.people);
      localStorage.setItem(APPOINTMENTS_FILE_ID_KEY, fileIds.appointments);
      localStorage.setItem(ATTACHMENTS_INDEX_FILE_ID_KEY, fileIds.index);
      localStorage.setItem(DATA_FOLDER_KEY, fileIds.dataFolderId);
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

  // Write to Drive when connected (debounced)
  useEffect(() => {
    if (!isConnected || !dataFolderIdRef.current || !initialDriveLoadDoneRef.current) return;
    const pid = peopleFileIdRef.current;
    const aid = appointmentsFileIdRef.current;
    const iid = indexFileIdRef.current;
    if (!pid || !aid || !iid) return;

    const t = setTimeout(() => {
      const now = new Date().toISOString();
      const peoplePayload: PeopleData = { version: 1, updatedAt: now, people };
      const appointmentsPayload: AppointmentsData = { version: 1, updatedAt: now, appointments };
      const indexPayload: AttachmentsIndexData = { version: 1, updatedAt: now, items: attachments, freeLimit: 20 };
      driveWriteJson(pid, peoplePayload).then(() => {
        localStorage.setItem(SYNC_PEOPLE_KEY, now);
        window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
      }).catch((e) => console.warn('Drive people write failed:', e));
      driveWriteJson(aid, appointmentsPayload).then(() => {
        localStorage.setItem(SYNC_APPOINTMENTS_KEY, now);
        window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
      }).catch((e) => console.warn('Drive appointments write failed:', e));
      driveWriteJson(iid, indexPayload).then(() => {
        localStorage.setItem(SYNC_INDEX_KEY, now);
        window.dispatchEvent(new CustomEvent('famplan-drive-data-sync-done'));
      }).catch((e) => console.warn('Drive index write failed:', e));
    }, 500);
    return () => clearTimeout(t);
  }, [isConnected, people, appointments, attachments]);

  const addPerson = (person: Omit<Person, 'id' | 'createdAt'>) => {
    if (!canEdit) return;
    const newPerson: Person = {
      ...person,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setPeople((prev) => [...prev, newPerson]);
  };

  const updatePerson = (id: string, data: Partial<Person>) => {
    if (!canEdit) return;
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  };

  const deletePerson = (id: string) => {
    if (!canEdit) return;
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setAppointments((prev) => prev.filter((a) => a.personId !== id));
    // Also delete attachments for those appointments
    const appointmentsToDelete = appointments.filter(a => a.personId === id).map(a => a.id);
    setAttachments((prev) => prev.filter((a) => !appointmentsToDelete.includes(a.appointmentId)));
  };

  const addAppointment = async (appointment: Omit<Appointment, 'id' | 'createdAt'>): Promise<Appointment> => {
    if (!canEdit) return { ...appointment, id: '', createdAt: 0 } as Appointment;
    const reminders = appointment.reminders?.length
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
  };

  const deleteAppointment = async (id: string) => {
    if (!canEdit) return;
    const prev = appointments.find((a) => a.id === id);
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

  const addAttachment = (attachment: Omit<Attachment, 'id' | 'createdAt'>) => {
    if (!canEdit) return;
    const newAttachment: Attachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setAttachments((prev) => [...prev, newAttachment]);
  };

  const deleteAttachment = (id: string) => {
    if (!canEdit) return;
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const deleteAttachments = (ids: string[]) => {
    if (!canEdit) return;
    setAttachments((prev) => prev.filter((a) => !ids.includes(a.id)));
  };

  return (
    <DataContext.Provider
      value={{
        people,
        appointments,
        attachments,
        addPerson,
        updatePerson,
        deletePerson,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        addAttachment,
        deleteAttachment,
        deleteAttachments,
        syncFromDrive,
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
