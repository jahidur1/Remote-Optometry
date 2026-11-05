
import { addDays, format, parse, isValid, startOfISOWeek, endOfISOWeek } from 'date-fns';

/**
 * Institutional Date Registry Helpers
 * 
 * Manages the transition from ISO Week IDs to strict 6-day range identifiers.
 * Format: YYYYMMDD-YYYYMMDD (Strictly Monday to Saturday)
 */

export function getDatesForWeek(weekId: string): Date[] {
  if (!weekId) return [];
  
  // 1. Precise Range Format: YYYYMMDD-YYYYMMDD
  if (weekId.includes('-') && weekId.length > 10) {
    const parts = weekId.split('-');
    if (parts.length === 2) {
      const start = parse(parts[0], 'yyyyMMdd', new Date());
      if (isValid(start)) {
        // Return 6 days: Monday to Saturday
        return Array.from({ length: 6 }, (_, i) => addDays(start, i));
      }
    }
  }

  // 2. Legacy Fallback: YYYY-WW (Normalized to Monday start)
  try {
    const [year, week] = weekId.split('-').map(Number);
    if (!isNaN(year) && !isNaN(week)) {
      const jan4 = new Date(year, 0, 4);
      const day = jan4.getDay() || 7;
      const startOfFirstWeek = addDays(jan4, 1 - day);
      const startOfTargetWeek = addDays(startOfFirstWeek, (week - 1) * 7);
      const monday = startOfISOWeek(startOfTargetWeek);
      return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
    }
  } catch (e) {
    // Pulse failure
  }
  
  return [];
}

/**
 * Forces any date to the Monday of its week to maintain institutional cycle integrity.
 * The range ends on Saturday (6 days total).
 */
export function formatWeekId(date: Date): string {
  const monday = startOfISOWeek(date);
  const saturday = addDays(monday, 5); // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat
  return `${format(monday, 'yyyyMMdd')}-${format(saturday, 'yyyyMMdd')}`;
}

/**
 * Retrieves the current week identifier based on institutional standards.
 */
export function getCurrentWeekId(): string {
  return formatWeekId(new Date());
}

export function displayWeekRange(weekId: string): string {
  if (!weekId) return 'Select Cycle';
  const dates = getDatesForWeek(weekId);
  if (dates.length === 0) return weekId;
  return `${format(dates[0], 'MMM dd')} - ${format(dates[5], 'MMM dd, yyyy')}`;
}

/**
 * Checks if a date falls within a range inclusive.
 */
export function isDateInRange(date: Date | undefined, startStr: string, endStr: string): boolean {
  if (!date || !isValid(date)) return false;
  const d = format(date, 'yyyy-MM-dd');
  return d >= startStr && d <= endStr;
}
