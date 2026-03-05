/**
 * Google Calendar API - direct fetch calls.
 * All requests visible in DevTools Network (filter "calendar").
 * Every request MUST include Authorization: Bearer <token> from GSI.
 * API key (VITE_GOOGLE_API_KEY) is required for "unregistered callers" fix.
 */

import { getStoredAccessToken } from './googleAuth';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const FAMPLAN_SUMMARY = 'FamPlan';
const DEFAULT_TZ = 'Asia/Jerusalem';

function getGoogleApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
}

/** Append API key to URL if configured (fixes 403 unregistered callers) */
function withApiKey(url: string): string {
  const key = getGoogleApiKey();
  if (!key?.trim()) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}key=${encodeURIComponent(key.trim())}`;
}

function getCalendarHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) {
    if (import.meta.env.DEV) console.warn('[FamPlan] Calendar API: Missing Google access token - reconnect required');
    window.dispatchEvent(new CustomEvent('famplan-auth-token-missing'));
    throw new Error('Missing Google access token');
  }
  if (import.meta.env.DEV) {
    console.log('[FamPlan] Calendar API: token exists, prefix:', token.slice(0, 8) + '...');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * GET users/me/calendarList
 */
export async function listCalendars(): Promise<{ items: Array<{ id: string; summary?: string }> }> {
  const params = new URLSearchParams({ maxResults: '250' });
  const url = withApiKey(`${CALENDAR_API}/users/me/calendarList?${params}`);
  const headers = getCalendarHeaders();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar API request:', url.replace(/key=[^&]+/, 'key=***'), 'headers:', Object.keys(headers));
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    const hint = res.status === 403 && /unregistered callers/i.test(body) && !getGoogleApiKey()?.trim()
      ? ' Add VITE_GOOGLE_API_KEY to .env'
      : '';
    throw new Error(`Calendar list failed: ${res.status}${hint}`);
  }
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

  const url = withApiKey(`${CALENDAR_API}/calendars`);
  const headers = getCalendarHeaders();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar API request:', url.replace(/key=[^&]+/, 'key=***'), 'headers:', Object.keys(headers));
  const res = await fetch(url, {
    method: 'POST',
    headers,
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

type EventPayload = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
};

/**
 * Validate and sanitize event payload before sending.
 * Google: NEVER send both default and overrides.
 * - With overrides: useDefault:false, overrides only.
 * - With no overrides: omit reminders (use calendar default).
 */
function validateEventPayload(payload: EventPayload): EventPayload {
  const tz = payload.start?.timeZone ?? payload.end?.timeZone ?? DEFAULT_TZ;
  let startDt = payload.start?.dateTime ? new Date(payload.start.dateTime) : new Date();
  let endDt = payload.end?.dateTime ? new Date(payload.end.dateTime) : new Date(startDt.getTime() + 60 * 60 * 1000);

  if (isNaN(startDt.getTime())) startDt = new Date();
  if (isNaN(endDt.getTime())) endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
  if (endDt <= startDt) endDt = new Date(startDt.getTime() + 60 * 60 * 1000);

  const startIso = startDt.toISOString();
  const endIso = endDt.toISOString();

  const rawOverrides = payload.reminders?.overrides ?? [];
  const overrides = rawOverrides
    .map((o) => ({ method: 'popup' as const, minutes: Math.max(0, Math.floor(Number(o.minutes) || 0)) }))
    .filter((o) => o.minutes >= 0);
  const seen = new Set<number>();
  const uniqueOverrides = overrides.filter((o) => {
    if (seen.has(o.minutes)) return false;
    seen.add(o.minutes);
    return true;
  });

  const result: EventPayload = {
    summary: payload.summary,
    description: payload.description,
    location: payload.location,
    start: { dateTime: startIso, timeZone: tz },
    end: { dateTime: endIso, timeZone: tz },
  };
  if (uniqueOverrides.length > 0) {
    result.reminders = { useDefault: false, overrides: uniqueOverrides };
  }
  if (!result.description) delete result.description;
  if (!result.location) delete result.location;
  return result;
}

function extractErrorReason(bodyText: string): string {
  try {
    const j = JSON.parse(bodyText);
    const msg = j?.error?.message ?? j?.error?.errors?.[0]?.message ?? j?.message;
    if (typeof msg === 'string') return msg;
  } catch {
    /* ignore */
  }
  return bodyText.slice(0, 200);
}

/**
 * POST calendars/{calendarId}/events
 */
export async function createEvent(
  calendarId: string,
  eventPayload: EventPayload
): Promise<{ id: string }> {
  const payload = validateEventPayload(eventPayload);
  console.log('[FamPlan] Calendar event insert payload:', JSON.stringify(payload));

  const url = withApiKey(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
  const headers = getCalendarHeaders();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar API request:', url.replace(/key=[^&]+/, 'key=***'), 'headers:', Object.keys(headers));
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    const reason = extractErrorReason(bodyText);
    console.error(`[FamPlan] Calendar event insert failed: ${res.status}`, bodyText);
    const needsApiKey = res.status === 403 && /unregistered callers/i.test(bodyText) && !getGoogleApiKey()?.trim();
    if (needsApiKey) {
      console.warn('[FamPlan] Add VITE_GOOGLE_API_KEY to .env - create API key in Google Cloud Console');
    }
    window.dispatchEvent(new CustomEvent('famplan-calendar-error', { detail: { status: res.status, reason, body: bodyText, needsApiKey } }));
    throw new Error(`Event create failed: ${res.status} - ${reason}`);
  }

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
  const url = withApiKey(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  const headers = getCalendarHeaders();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar API request:', url.replace(/key=[^&]+/, 'key=***'), 'headers:', Object.keys(headers));
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Event update failed: ${res.status}`);
  const data = await res.json();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar event update response', data);
}

/**
 * DELETE calendars/{calendarId}/events/{eventId}
 */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const url = withApiKey(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  const headers = getCalendarHeaders();
  if (import.meta.env.DEV) console.log('[FamPlan] Calendar API request:', url.replace(/key=[^&]+/, 'key=***'), 'headers:', Object.keys(headers));
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 204) throw new Error(`Event delete failed: ${res.status}`);
}

/**
 * Build event payload from plan.
 * - If plan has reminders: reminders = { useDefault: false, overrides: [...] }
 * - If plan has NO reminders: omit reminders (use calendar default)
 */
export function planToEventPayload(plan: {
  title: string;
  start: number;
  end: number;
  location?: string;
  notes?: string;
  reminders?: { minutesBeforeStart: number }[];
}): EventPayload {
  const tz = DEFAULT_TZ;
  const startDate = new Date(plan.start);
  const endDate = new Date(plan.end);

  const result: EventPayload = {
    summary: plan.title,
    description: plan.notes || undefined,
    location: plan.location || undefined,
    start: { dateTime: startDate.toISOString(), timeZone: tz },
    end: { dateTime: endDate.toISOString(), timeZone: tz },
  };

  if (plan.reminders && plan.reminders.length > 0) {
    const raw = plan.reminders.map((r) => Math.max(0, Math.floor(r.minutesBeforeStart ?? 0)));
    const uniqueMinutes = [...new Set(raw)].filter((m) => m > 0).sort((a, b) => b - a);
    if (uniqueMinutes.length > 0) {
      result.reminders = {
        useDefault: false,
        overrides: uniqueMinutes.map((m) => ({ method: 'popup' as const, minutes: m })),
      };
    }
  }

  return result;
}
