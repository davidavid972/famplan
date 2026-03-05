/**
 * 24-hour time formatting (no AM/PM).
 * Uses Intl for locale-aware display with hour12: false.
 */

export function formatTime24(date: Date, locale: string = 'he-IL'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTime24(date: Date, locale: string = 'he-IL'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
