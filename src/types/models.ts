export interface Person {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  /** Drive file id for person photo (stored in FamPlan/people_photos/) */
  photoFileId?: string | null;
  /** Emoji avatar when no photo (e.g. 👨 👩 👦 👧) */
  emoji?: string | null;
}

export type AppointmentStatus = 'PLANNED' | 'DONE';

export interface Reminder {
  minutesBeforeStart: number;
}

export interface Appointment {
  id: string;
  personId: string;
  title: string;
  start: number;
  end: number;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  reminders?: Reminder[];
  createdAt: number;
  calendarEventId?: string;
  /** Links instances of a recurring series */
  recurrenceGroupId?: string | null;
}

export interface Attachment {
  id: string;
  appointmentId: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  uploaderId: string;
}

export interface Family {
  id: string;
  name: string;
  createdAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface ActivityLog {
  id: string;
  action: string;
  entityId: string;
  entityType: string;
  timestamp: number;
  userId: string;
}
