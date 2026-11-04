/**
 * @fileOverview Institutional Integrity Guard.
 * 
 * Re-verifies mathematical solver output against hard clinical rules.
 * This is the final gate before any roster draft is committed to the registry.
 */

export type IntegrityCheckResult = {
  isValid: boolean;
  issues: string[];
};

export function verifyRosterIntegrity(
  assignments: any[],
  bookings: any[],
  leaves: any[],
  weekDates: Date[]
): IntegrityCheckResult {
  const issues: string[] = [];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  assignments.forEach(a => {
    // Only check valid shift assignments (skip markers like 'none' or 'unassigned')
    if (!a.shiftId || a.shiftId === 'none') return;

    // 1. FCFS Protection: No assignments on protected Weekly-Offs
    const isOff = bookings.some(b => b.employeeId === a.employeeId && b.dayOfWeek === a.dayOfWeek);
    if (isOff) {
      issues.push(`CRITICAL: Professional ${a.employeeId} assigned shift ${a.shiftId} on protected Weekly-Off (${a.dayOfWeek}).`);
    }

    // 2. Absence Protection: No assignments during approved leave
    const dayIdx = DAYS.indexOf(a.dayOfWeek);
    if (dayIdx !== -1) {
      const date = weekDates[dayIdx].toISOString().split('T')[0];
      const onLeave = leaves.some(l => l.employeeId === a.employeeId && date >= l.startDate && date <= l.endDate && l.status === 'approved');
      if (onLeave) {
        issues.push(`CRITICAL: Professional ${a.employeeId} assigned shift ${a.shiftId} during approved absence (${a.dayOfWeek} / ${date}).`);
      }
    }
  });

  // 3. Zero-Overlap: Single assignment per professional per day
  const keys = assignments
    .filter(a => a.shiftId && a.shiftId !== 'none')
    .map(a => `${a.employeeId}_${a.dayOfWeek}`);
  
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    issues.push(`CRITICAL: Double-assignment detected for one or more professionals within the same clinical day.`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}
