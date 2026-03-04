import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Person, Appointment, Attachment } from '../types/models';
import { v4 as uuidv4 } from 'uuid';

interface DataContextType {
  people: Person[];
  appointments: Appointment[];
  attachments: Attachment[];
  addPerson: (person: Omit<Person, 'id' | 'createdAt'>) => void;
  updatePerson: (id: string, person: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => void;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  addAttachment: (attachment: Omit<Attachment, 'id' | 'createdAt'>) => void;
  deleteAttachment: (id: string) => void;
  deleteAttachments: (ids: string[]) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const loadData = <T,>(key: string, defaultValue: T[]): T[] => {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(`Error parsing ${key} from localStorage`, e);
      return defaultValue;
    }
  }
  return defaultValue;
};

const saveData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [people, setPeople] = useState<Person[]>(() => loadData('famplan_people', []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadData('famplan_appointments', []));
  const [attachments, setAttachments] = useState<Attachment[]>(() => loadData('famplan_attachments', []));

  useEffect(() => {
    saveData('famplan_people', people);
  }, [people]);

  useEffect(() => {
    saveData('famplan_appointments', appointments);
  }, [appointments]);

  useEffect(() => {
    saveData('famplan_attachments', attachments);
  }, [attachments]);

  const addPerson = (person: Omit<Person, 'id' | 'createdAt'>) => {
    const newPerson: Person = {
      ...person,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setPeople((prev) => [...prev, newPerson]);
  };

  const updatePerson = (id: string, data: Partial<Person>) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  };

  const deletePerson = (id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setAppointments((prev) => prev.filter((a) => a.personId !== id));
    // Also delete attachments for those appointments
    const appointmentsToDelete = appointments.filter(a => a.personId === id).map(a => a.id);
    setAttachments((prev) => prev.filter((a) => !appointmentsToDelete.includes(a.appointmentId)));
  };

  const addAppointment = (appointment: Omit<Appointment, 'id' | 'createdAt'>) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setAppointments((prev) => [...prev, newAppointment]);
  };

  const updateAppointment = (id: string, data: Partial<Appointment>) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
  };

  const deleteAppointment = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setAttachments((prev) => prev.filter((a) => a.appointmentId !== id));
  };

  const addAttachment = (attachment: Omit<Attachment, 'id' | 'createdAt'>) => {
    const newAttachment: Attachment = {
      ...attachment,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setAttachments((prev) => [...prev, newAttachment]);
  };

  const deleteAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const deleteAttachments = (ids: string[]) => {
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
