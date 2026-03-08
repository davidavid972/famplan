import type { Appointment } from '../types/models';

/** Validate appointment has required fields for render */
function isValidAppointment(a: unknown): a is Appointment {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.personId === 'string' &&
    typeof o.title === 'string' &&
    typeof o.start === 'number' &&
    !Number.isNaN(o.start) &&
    typeof o.end === 'number' &&
    !Number.isNaN(o.end) &&
    (o.status === 'PLANNED' || o.status === 'DONE') &&
    typeof o.createdAt === 'number'
  );
}

/** Return only valid appointments; never throw */
export function validateAppointments(data: unknown): Appointment[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isValidAppointment);
}
