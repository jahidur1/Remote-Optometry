
import { startOfISOWeek, addDays, format, parseISO } from 'date-fns';

/**
 * Gets an array of dates for a given ISO week string (YYYY-WW).
 */
export function getDatesForWeek(weekId: string): Date[] {
  try {
    const [year, week] = weekId.split('-').map(Number);
    // Simple way to get the start of the week for YYYY-WW
    // Note: This is a simplified version; production might use a library like moment or more complex date-fns logic
    const jan4 = new Date(year, 0, 4);
    const day = jan4.getDay() || 7;
    const startOfFirstWeek = addDays(jan4, 1 - day);
    const startOfTargetWeek = addDays(startOfFirstWeek, (week - 1) * 7);
    
    return Array.from({ length: 7 }, (_, i) => addDays(startOfTargetWeek, i));
  } catch (e) {
    return [];
  }
}

/**
 * Checks if a date falls within a range inclusive.
 */
export function isDateInRange(date: Date, startStr: string, endStr: string): boolean {
  const d = format(date, 'yyyy-MM-dd');
  return d >= startStr && d <= endStr;
}
