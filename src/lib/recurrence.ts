/**
 * Weekly recurrence: generate occurrence start timestamps.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export interface RecurrenceParams {
  intervalWeeks: number;
  endCondition: 'date' | 'count';
  endDate?: number; // ms
  count?: number;
}

/**
 * Generate start timestamps for each occurrence.
 * @param startMs First occurrence start
 * @param params Recurrence params
 * @returns Array of start timestamps (ms)
 */
export function generateRecurrenceStarts(startMs: number, params: RecurrenceParams): number[] {
  const { intervalWeeks, endCondition, endDate, count } = params;
  const results: number[] = [];
  let current = startMs;
  const step = intervalWeeks * MS_PER_WEEK;

  const maxCount = endCondition === 'count' && count != null ? Math.max(1, Math.min(count, 100)) : 100;
  const cutoff = endCondition === 'date' && endDate != null ? endDate : Number.POSITIVE_INFINITY;

  for (let i = 0; i < maxCount; i++) {
    if (current > cutoff) break;
    results.push(current);
    current += step;
  }

  return results;
}
