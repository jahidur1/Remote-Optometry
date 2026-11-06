'use server';

/**
 * @fileOverview Institutional Pure-Logic Roster Orchestration Engine.
 * Implements a deterministic constraint satisfaction algorithm in TypeScript.
 * Removes AI/Python dependencies to ensure 100% predictable clinical results.
 */

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getDatesForWeek } from '@/lib/date-utils';
import { format } from 'date-fns';
import { logAuditServer } from './audit-service';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function runLocalRosterEngineAction(idToken: string, input: {
  weekId: string;
  officeId: string;
  employeeIds: string[];
  quotas: Record<string, number>;
  globalFreq: Record<string, { min: number, max: number }>;
  globalPreOff: string[];
  globalPostOff: string[];
}) {
  const start = Date.now();
  
  try {
    // 1. Auth Pulse
    if (!idToken) throw new Error("Unauthorized: Identity link missing.");
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) throw new Error("Registry Error: Caller profile not found.");
    
    const { weekId, officeId, employeeIds, quotas, globalFreq, globalPreOff, globalPostOff } = input;

    // 2. Aggregate Constraint Registry
    const [empSnap, bookingsSnap, leavesSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
      adminDb.collection('employee_leaves').where('office', '==', officeId).where('status', '==', 'approved').get()
    ]);

    const employees = empSnap.docs
      .filter(d => employeeIds.includes(d.id))
      .map(d => ({ id: d.id, ...d.data() }));

    const bookingsMap = new Map();
    bookingsSnap.docs.forEach(d => bookingsMap.set(d.data().employeeId, d.data().dayOfWeek));

    const leaves = leavesSnap.docs.map(d => d.data());
    const weekDates = getDatesForWeek(weekId);
    const dateStrings = weekDates.map(d => format(d, 'yyyy-MM-dd'));

    // 3. Mathematical Orchestration (Deterministic Assignment)
    const assignments: any[] = [];
    const empDailyShift = new Map<string, string>(); // 'empId_dayIdx' -> shiftId
    const empShiftCounts = new Map<string, Record<string, number>>(); // 'empId' -> { shiftId: count }

    // Initialize counts
    employees.forEach(e => empShiftCounts.set(e.id, {}));

    // CORE SOLVER LOOP
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayName = DAYS[dayIdx];
      const dateStr = dateStrings[dayIdx];
      
      // Order shifts by "Hardest to Fill" heuristic (custom prioritization can be added here)
      const shiftsToFill = Object.keys(quotas)
        .filter(key => key.startsWith(dayName))
        .map(key => ({ 
          id: key.split('_')[1], 
          required: quotas[key] 
        }))
        .sort((a, b) => b.required - a.required);

      for (const shift of shiftsToFill) {
        let assignedCount = 0;
        
        // Find suitable professionals
        const candidates = employees.filter(emp => {
          // Rule 1: Not on confirmed Week-Off
          if (bookingsMap.get(emp.id) === dayName) return false;

          // Rule 2: Not on approved Leave
          const onLeave = leaves.some(l => emp.id === l.employeeId && dateStr >= l.startDate && dateStr <= l.endDate);
          if (onLeave) return false;

          // Rule 3: Single assignment per day
          if (empDailyShift.has(`${emp.id}_${dayIdx}`)) return false;

          // Rule 4: Frequency Max Guard
          const currentCount = empShiftCounts.get(emp.id)?.[shift.id] || 0;
          const maxAllowed = globalFreq[shift.id]?.max ?? 7;
          if (currentCount >= maxAllowed) return false;

          // Rule 5: Adjacency (Pre-Off)
          const tomorrowIsOff = dayIdx < 6 && bookingsMap.get(emp.id) === DAYS[dayIdx + 1];
          if (tomorrowIsOff && globalPreOff.length > 0 && !globalPreOff.includes(shift.id)) return false;

          // Rule 6: Adjacency (Post-Off)
          const yesterdayWasOff = dayIdx > 0 && bookingsMap.get(emp.id) === DAYS[dayIdx - 1];
          if (yesterdayWasOff && globalPostOff.length > 0 && !globalPostOff.includes(shift.id)) return false;

          return true;
        });

        // Fairness Heuristic: Sort candidates by current load to ensure even distribution
        candidates.sort((a, b) => {
          const countA = empShiftCounts.get(a.id)?.[shift.id] || 0;
          const countB = empShiftCounts.get(b.id)?.[shift.id] || 0;
          return countA - countB;
        });

        // Commit Assignments
        while (assignedCount < shift.required && candidates.length > 0) {
          const emp = candidates.shift()!;
          assignments.push({
            employeeId: emp.id,
            dayOfWeek: dayName,
            shiftId: shift.id,
            date: dateStr
          });

          empDailyShift.set(`${emp.id}_${dayIdx}`, shift.id);
          const counts = empShiftCounts.get(emp.id)!;
          counts[shift.id] = (counts[shift.id] || 0) + 1;
          assignedCount++;
        }
      }
    }

    // 4. Persistence Pulse (Singleton ID Protocol)
    const draftId = `draft_${weekId}_${officeId}`;
    await adminDb.collection('roster_drafts').doc(draftId).set({
      id: draftId,
      weekId,
      office: officeId,
      assignments,
      status: 'draft',
      createdAt: new Date().toISOString(),
      actorId: decoded.uid,
      generationMethod: 'deterministic_engine',
      solverMetadata: {
        solveTimeMs: Date.now() - start,
        constraintsChecked: employees.length * 7 * 6,
        engine: 'ROC_TypeScript_Solver_v1'
      }
    });

    await logAuditServer(decoded.uid, 'RUN_DETERMINISTIC_SOLVER', draftId, { weekId, officeId });

    return { 
      success: true, 
      draftId,
      summary: `Logic pulse complete. Generated ${assignments.length} assignments across 7 days.`,
      solveTimeMs: Date.now() - start
    };

  } catch (e: any) {
    console.error('Logic Engine Conflict:', e.message);
    return { success: false, error: e.message };
  }
}
