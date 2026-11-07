import { addDays, format, parse, isValid, startOfISOWeek, endOfISOWeek } from 'date-fns';

/**
 * Institutional Date Registry Helpers
 * 
 * Manages the transition to strict 7-day range identifiers.
 * Format: YYYYMMDD-YYYYMMDD (Strictly Monday to Sunday)
 */

/**
 * Retrieves the current date/time in Asia/Kolkata.
 */
export function getISTNow(): Date {
  const istStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(istStr);
}

export function getDatesForWeek(weekId: string): Date[] {
  if (!weekId) return [];
  
  // 1. Precise Range Format: YYYYMMDD-YYYYMMDD
  if (weekId.includes('-') && weekId.length > 10) {
    const parts = weekId.split('-');
    if (parts.length === 2) {
      const start = parse(parts[0], 'yyyyMMdd', new Date());
      if (isValid(start)) {
        // Return 7 days: Monday to Sunday
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
      }
    }
  }

  // 2. Legacy Fallback: YYYY-WW (Normalized to Monday start)
  try {
    const parts = weekId.split('-');
    if (parts.length === 2 && parts[1].length <= 2) {
      const year = parseInt(parts[0]);
      const week = parseInt(parts[1]);
      if (!isNaN(year) && !isNaN(week)) {
        const jan4 = new Date(year, 0, 4);
        const day = jan4.getDay() || 7;
        const startOfFirstWeek = addDays(jan4, 1 - day);
        const startOfTargetWeek = addDays(startOfFirstWeek, (week - 1) * 7);
        const monday = startOfISOWeek(startOfTargetWeek);
        return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      }
    }
  } catch (e) {
    // Pulse failure
  }
  
  return [];
}

/**
 * Forces any date to the Monday of its week to maintain institutional cycle integrity.
 * The range ends on Sunday (7 days total).
 */
export function formatWeekId(date: Date): string {
  const monday = startOfISOWeek(date);
  const sunday = addDays(monday, 6); 
  return `${format(monday, 'yyyyMMdd')}-${format(sunday, 'yyyyMMdd')}`;
}

/**
 * Retrieves the current week identifier based on institutional standards.
 */
export function getCurrentWeekId(): string {
  return formatWeekId(getISTNow());
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
export function isDateInRange(date: Date | undefined, startStr: string, endStr: string): boolean {
  if (!date || !isValid(date)) return false;
  const d = format(date, 'yyyy-MM-dd');
  return d >= startStr && d <= endStr;
}
