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

  // 1. Clean Assignments: Exclude non-operational markers
  const activeAssignments = assignments.filter(a => a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned');

  activeAssignments.forEach(a => {
    // 2. FCFS Protection: No assignments on protected Weekly-Offs
    const isOff = bookings.some(b => 
      b.employeeId === a.employeeId && 
      b.dayOfWeek === a.dayOfWeek &&
      b.status === 'confirmed'
    );
    
    if (isOff) {
      issues.push(`CRITICAL: Professional ${a.employeeId} assigned shift ${a.shiftId} on protected Weekly-Off (${a.dayOfWeek}).`);
    }

    // 3. Absence Protection: No assignments during approved leave window
    const dayIdx = DAYS.indexOf(a.dayOfWeek);
    if (dayIdx !== -1 && weekDates[dayIdx]) {
      const dateStr = weekDates[dayIdx].toISOString().split('T')[0];
      const onLeave = leaves.some(l => 
        l.employeeId === a.employeeId && 
        dateStr >= l.startDate && 
        dateStr <= l.endDate && 
        l.status === 'approved'
      );
      
      if (onLeave) {
        issues.push(`CRITICAL: Professional ${a.employeeId} assigned shift ${a.shiftId} during approved absence window (${a.dayOfWeek} / ${dateStr}).`);
      }
    }
  });

  // 4. Zero-Overlap: Single assignment per professional per clinical day
  const assignmentKeys = activeAssignments.map(a => `${a.employeeId}_${a.dayOfWeek}`);
  const uniqueKeys = new Set(assignmentKeys);
  
  if (assignmentKeys.length !== uniqueKeys.size) {
    const duplicates = assignmentKeys.filter((item, index) => assignmentKeys.indexOf(item) !== index);
    issues.push(`CRITICAL: Double-assignment detected for ${duplicates.join(', ')}. Single shift per day policy enforced.`);
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}
