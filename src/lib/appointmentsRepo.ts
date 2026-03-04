import {
  getRootFolderId,
  findFolderByName,
  findFileByName,
  readJsonFile,
  updateJsonFile,
} from "./googleDrive";
import { t } from "../i18n";

export interface Reminder {
  minutesBeforeStart: number;
}

export interface Appointment {
  id: string;
  personId: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  location?: string;
  notes?: string;
  assignedToPersonId?: string;
  status: string;
  reminders?: Reminder[];
  createdAt: string;
  calendarEventId?: string;
  calendarLastSyncedAt?: string;
}

interface AppointmentsFile {
  appointments: Appointment[];
}

interface ActivityLog {
  events: unknown[];
}

async function getDataFolderId(): Promise<string> {
  const rootId = getRootFolderId();
  const dataId = await findFolderByName(rootId, "data");
  if (!dataId) throw new Error(t("drive_data_not_found"));
  return dataId;
}

export async function loadAppointments(): Promise<Appointment[]> {
  const dataId = await getDataFolderId();
  const fileId = await findFileByName(dataId, "appointments.json");
  if (!fileId) return [];
  const data = await readJsonFile<AppointmentsFile>(fileId);
  return data.appointments ?? [];
}

export async function addAppointment(input: {
  personId: string;
  title: string;
  startDateTime: string;
  endDateTime?: string;
  location?: string;
  notes?: string;
  assignedToPersonId?: string;
  reminders?: Reminder[];
}): Promise<Appointment> {
  if (!input.personId) throw new Error(t("today_person_required"));
  if (!input.title.trim()) throw new Error(t("today_title_required"));
  if (!input.startDateTime) throw new Error(t("today_datetime_required"));

  const dataId = await getDataFolderId();

  const [apptFileId, logFileId] = await Promise.all([
    findFileByName(dataId, "appointments.json"),
    findFileByName(dataId, "activity_log.json"),
  ]);

  if (!apptFileId) throw new Error(t("err_file_not_found", { file: "appointments.json" }));

  const apptData = await readJsonFile<AppointmentsFile>(apptFileId);
  const appointments = apptData.appointments ?? [];

  const reminders = (input.reminders && input.reminders.length > 0)
    ? input.reminders
    : [{ minutesBeforeStart: 15 }];

  const newAppt: Appointment = {
    id: crypto.randomUUID(),
    personId: input.personId,
    title: input.title.trim(),
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime || undefined,
    location: input.location?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    assignedToPersonId: input.assignedToPersonId || undefined,
    status: "מתוכנן",
    reminders,
    createdAt: new Date().toISOString(),
  };

  const updated = [...appointments, newAppt];
  await updateJsonFile(apptFileId, { appointments: updated });

  if (logFileId) {
    const logData = await readJsonFile<ActivityLog>(logFileId);
    const events = logData.events ?? [];
    events.push({
      type: "appointment.add",
      timestamp: newAppt.createdAt,
      before: appointments,
      after: updated,
    });
    await updateJsonFile(logFileId, { events });
  }

  return newAppt;
}

export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: string
): Promise<void> {
  const dataId = await getDataFolderId();

  const [apptFileId, logFileId] = await Promise.all([
    findFileByName(dataId, "appointments.json"),
    findFileByName(dataId, "activity_log.json"),
  ]);

  if (!apptFileId) throw new Error(t("err_file_not_found", { file: "appointments.json" }));

  const apptData = await readJsonFile<AppointmentsFile>(apptFileId);
  const appointments = apptData.appointments ?? [];

  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx === -1) throw new Error(t("err_appointment_not_found"));

  const before = [...appointments];
  appointments[idx] = { ...appointments[idx], status: newStatus };

  await updateJsonFile(apptFileId, { appointments });

  if (logFileId) {
    const logData = await readJsonFile<ActivityLog>(logFileId);
    const events = logData.events ?? [];
    events.push({
      type: "appointment.statusChange",
      timestamp: new Date().toISOString(),
      appointmentId,
      oldStatus: before[idx].status,
      newStatus,
      before: before,
      after: appointments,
    });
    await updateJsonFile(logFileId, { events });
  }
}

export async function deleteAppointment(appointmentId: string): Promise<Appointment> {
  if (import.meta.env.DEV) {
    console.log("[FamPlan] deleteAppointment called", { appointmentId });
  }

  const dataId = await getDataFolderId();

  const [apptFileId, logFileId] = await Promise.all([
    findFileByName(dataId, "appointments.json"),
    findFileByName(dataId, "activity_log.json"),
  ]);

  if (!apptFileId) throw new Error(t("err_file_not_found", { file: "appointments.json" }));

  const apptData = await readJsonFile<AppointmentsFile>(apptFileId);
  const appointments = apptData.appointments ?? [];

  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx === -1) throw new Error(t("err_appointment_not_found"));

  const deleted = { ...appointments[idx] };
  const updated = appointments.filter((_, i) => i !== idx);
  await updateJsonFile(apptFileId, { appointments: updated });

  if (import.meta.env.DEV) {
    console.log("[FamPlan] deleteAppointment Drive save complete", { appointmentId });
  }

  if (logFileId) {
    const logData = await readJsonFile<ActivityLog>(logFileId);
    const events = logData.events ?? [];
    events.push({
      type: "appointment.delete",
      timestamp: new Date().toISOString(),
      appointmentId,
      deleted,
      before: appointments,
      after: updated,
    });
    await updateJsonFile(logFileId, { events });
  }

  return deleted;
}

export async function updateAppointment(
  appointmentId: string,
  patch: Partial<Omit<Appointment, "id">>
): Promise<void> {
  const dataId = await getDataFolderId();

  const [apptFileId, logFileId] = await Promise.all([
    findFileByName(dataId, "appointments.json"),
    findFileByName(dataId, "activity_log.json"),
  ]);

  if (!apptFileId) throw new Error(t("err_file_not_found", { file: "appointments.json" }));

  const apptData = await readJsonFile<AppointmentsFile>(apptFileId);
  const appointments = apptData.appointments ?? [];

  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx === -1) throw new Error(t("err_appointment_not_found"));

  const before = [...appointments];
  appointments[idx] = { ...appointments[idx], ...patch };

  await updateJsonFile(apptFileId, { appointments });

  if (logFileId) {
    const logData = await readJsonFile<ActivityLog>(logFileId);
    const events = logData.events ?? [];
    events.push({
      type: "appointment.update",
      timestamp: new Date().toISOString(),
      appointmentId,
      patch,
      before,
      after: appointments,
    });
    await updateJsonFile(logFileId, { events });
  }
}
