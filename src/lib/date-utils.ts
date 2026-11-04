
import { addDays, format, parse, isValid, differenceInDays } from 'date-fns';

/**
 * Institutional Date Registry Helpers
 * 
 * Manages the transition from ISO Week IDs to strict 7-day range identifiers.
 * Format: YYYYMMDD-YYYYMMDD
 */

export function getDatesForWeek(weekId: string): Date[] {
  if (!weekId) return [];
  
  // 1. Precise Range Format: YYYYMMDD-YYYYMMDD
  if (weekId.includes('-') && weekId.length > 10) {
    const parts = weekId.split('-');
    if (parts.length === 2) {
      const start = parse(parts[0], 'yyyyMMdd', new Date());
      if (isValid(start)) {
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
      }
    }
  }

  // 2. Legacy Fallback: YYYY-WW
  try {
    const [year, week] = weekId.split('-').map(Number);
    if (!isNaN(year) && !isNaN(week)) {
      const jan4 = new Date(year, 0, 4);
      const day = jan4.getDay() || 7;
      const startOfFirstWeek = addDays(jan4, 1 - day);
      const startOfTargetWeek = addDays(startOfFirstWeek, (week - 1) * 7);
      return Array.from({ length: 7 }, (_, i) => addDays(startOfTargetWeek, i));
    }
  } catch (e) {
    // Pulse failure
  }
  
  return [];
}

export function formatWeekId(start: Date): string {
  const end = addDays(start, 6);
  return `${format(start, 'yyyyMMdd')}-${format(end, 'yyyyMMdd')}`;
}

export function displayWeekRange(weekId: string): string {
  if (!weekId) return 'Select Cycle';
  const dates = getDatesForWeek(weekId);
  if (dates.length === 0) return weekId;
  return `${format(dates[0], 'MMM dd')} - ${format(dates[6], 'MMM dd, yyyy')}`;
}

/**
 * Checks if a date falls within a range inclusive.
 */
export function isDateInRange(date: Date, startStr: string, endStr: string): boolean {
  const d = format(date, 'yyyy-MM-dd');
  return d >= startStr && d <= endStr;
}
