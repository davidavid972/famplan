/**
 * Google Calendar API - direct fetch calls.
 * All requests visible in DevTools Network (filter "calendar").
 */

import { getStoredAccessToken } from './googleAuth';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const FAMPLAN_SUMMARY = 'FamPlan';

function getAuthHeader(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

/**
 * GET users/me/calendarList
 */
export async function listCalendars(): Promise<{ items: Array<{ id: string; summary?: string }> }> {
  const params = new URLSearchParams({ maxResults: '250' });
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList?${params}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error(`Calendar list failed: ${res.status}`);
  return res.json();
}

/**
 * Ensure FamPlan calendar exists. Find by summary or POST to create.
 * Returns calendarId. For CalendarModal: use listCalendars to check multiple.
 */
export async function ensureFamPlanCalendar(): Promise<string> {
  const data = await listCalendars();
  const famPlanList = (data.items ?? []).filter((c) => (c.summary ?? '').trim() === FAMPLAN_SUMMARY);
  if (famPlanList.length > 0) return famPlanList[0].id;

  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: FAMPLAN_SUMMARY }),
  });
  if (!res.ok) throw new Error(`Calendar create failed: ${res.status}`);
  const created = await res.json();
  return created.id;
}

/**
 * For CalendarModal: ensure and return { calendarId, multipleFound }.
 */
export async function ensureFamPlanCalendarWithMeta(stored?: string | null): Promise<{ calendarId: string; multipleFound: boolean }> {
  const data = await listCalendars();
  const famPlanList = (data.items ?? []).filter((c) => (c.summary ?? '').trim() === FAMPLAN_SUMMARY);
  if (famPlanList.length === 0) {
    const id = await ensureFamPlanCalendar();
    return { calendarId: id, multipleFound: false };
  }
  if (famPlanList.length === 1) return { calendarId: famPlanList[0].id, multipleFound: false };
  const preferred = stored && famPlanList.some((c) => c.id === stored) ? stored : famPlanList[0].id;
  return { calendarId: preferred, multipleFound: true };
}

/**
 * POST calendars/{calendarId}/events
 */
export async function createEvent(
  calendarId: string,
  eventPayload: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    reminders?: { overrides: { method: string; minutes: number }[] };
  }
): Promise<{ id: string }> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(eventPayload),
  });
  if (!res.ok) throw new Error(`Event create failed: ${res.status}`);
  const data = await res.json();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar event insert response', data);
  return { id: data.id };
}

/**
 * PATCH calendars/{calendarId}/events/{eventId}
 */
export async function updateEvent(
  calendarId: string,
  eventId: string,
  payload: Partial<{
    summary: string;
    description: string;
    location: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    reminders: { overrides: { method: string; minutes: number }[] };
  }>
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Event update failed: ${res.status}`);
  const data = await res.json();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar event update response', data);
}

/**
 * DELETE calendars/{calendarId}/events/{eventId}
 */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: getAuthHeader() }
  );
  if (!res.ok && res.status !== 204) throw new Error(`Event delete failed: ${res.status}`);
}

/**
 * Build event payload from plan. Reminders: plan minutes -> overrides (popup). Default 15 min.
 */
export function planToEventPayload(plan: {
  title: string;
  start: number;
  end: number;
  location?: string;
  notes?: string;
  reminders?: { minutesBeforeStart: number }[];
}): {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders: { overrides: { method: string; minutes: number }[] };
} {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const overrides = (plan.reminders?.length ? plan.reminders : [{ minutesBeforeStart: 15 }]).map((r) => ({
    method: 'popup' as const,
    minutes: r.minutesBeforeStart,
  }));
  return {
    summary: plan.title,
    description: plan.notes || undefined,
    location: plan.location || undefined,
    start: { dateTime: new Date(plan.start).toISOString(), timeZone: tz },
    end: { dateTime: new Date(plan.end).toISOString(), timeZone: tz },
    reminders: { overrides },
  };
}
