/**
 * Google Calendar API helper - list/create calendars, create/update/delete events.
 * Handles duplicate FamPlan calendars safely.
 */

import { getStoredAccessToken } from './googleAuth';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const FAMPLAN_CALENDAR_SUMMARY = 'FamPlan';

function getAuthHeader(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

interface CalendarListEntry {
  id: string;
  summary?: string;
}

/**
 * List ALL calendars with summary === "FamPlan".
 */
export async function listFamPlanCalendars(): Promise<CalendarListEntry[]> {
  const items: CalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: '250' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${CALENDAR_API}/users/me/calendarList?${params}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error(`Calendar list failed: ${res.status}`);
    const data = await res.json();
    const famPlan = (data.items ?? []).filter(
      (c: { summary?: string }) => (c.summary ?? '').trim() === FAMPLAN_CALENDAR_SUMMARY
    );
    items.push(...famPlan.map((c: { id: string; summary?: string }) => ({ id: c.id, summary: c.summary })));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

/**
 * Create a new FamPlan calendar.
 */
async function createFamPlanCalendar(): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: FAMPLAN_CALENDAR_SUMMARY }),
  });
  if (!res.ok) throw new Error(`Calendar create failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export interface EnsureCalendarResult {
  calendarId: string;
  multipleFound: boolean;
}

/**
 * Ensure we have exactly one FamPlan calendar to use.
 * - Search ALL calendars with summary === "FamPlan"
 * - If 1: use it
 * - If multiple: prefer storedCalendarId if present and in list, else first
 * - If 0: create new (only when none exist)
 * - Never delete calendars
 */
export async function ensureFamPlanCalendar(storedCalendarId?: string | null): Promise<EnsureCalendarResult> {
  const all = await listFamPlanCalendars();
  if (all.length === 0) {
    const id = await createFamPlanCalendar();
    return { calendarId: id, multipleFound: false };
  }
  if (all.length === 1) {
    return { calendarId: all[0].id, multipleFound: false };
  }
  const preferred = storedCalendarId && all.some((c) => c.id === storedCalendarId)
    ? storedCalendarId
    : all[0].id;
  return { calendarId: preferred, multipleFound: true };
}

/**
 * Create an event. Use calendarId from ensureFamPlanCalendar / family.json.
 */
export async function createEvent(
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string } | { date: string };
    end: { dateTime: string; timeZone?: string } | { date: string };
    reminders?: { useDefault: boolean } | { overrides: { method: string; minutes: number }[] };
  }
): Promise<{ id: string }> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Event create failed: ${res.status}`);
  const data = await res.json();
  return { id: data.id };
}

/**
 * Update an event.
 */
export async function updateEvent(
  calendarId: string,
  eventId: string,
  patch: Partial<{
    summary: string;
    description: string;
    location: string;
    start: { dateTime: string; timeZone?: string } | { date: string };
    end: { dateTime: string; timeZone?: string } | { date: string };
    reminders: { useDefault: boolean } | { overrides: { method: string; minutes: number }[] };
  }>
): Promise<void> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Event update failed: ${res.status}`);
}

/**
 * Get the chosen FamPlan calendar ID (from localStorage, set by Calendar modal).
 * Use this for create/update/delete events.
 */
export function getCalendarId(): string | null {
  return localStorage.getItem('famplan_calendar_id');
}

/**
 * Delete an event.
 */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: getAuthHeader() }
  );
  if (!res.ok && res.status !== 204) throw new Error(`Event delete failed: ${res.status}`);
}
