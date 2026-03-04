export interface Person {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type AppointmentStatus = 'PLANNED' | 'DONE';

export interface Appointment {
  id: string;
  personId: string;
  title: string;
  start: number;
  end: number;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: number;
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
