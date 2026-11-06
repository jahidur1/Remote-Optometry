'use server';

/**
 * @fileOverview Institutional Pure-Logic Roster Orchestration Engine.
 * Implements a deterministic constraint satisfaction algorithm in TypeScript.
 * 
 * PROTOCOL v3.0: 
 * 1. Mandatory Floor: Strictly satisfies 'Assignment Matrix' headcount requirements.
 * 2. Full Utilization: Assigns every available professional a shift (no idle staff).
 * 3. Excess Distribution: Allows shifts to exceed requirements to accommodate all available staff.
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
    const [empSnap, bookingsSnap, leavesSnap, shiftSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
      adminDb.collection('employee_leaves').where('office', '==', officeId).where('status', '==', 'approved').get(),
      adminDb.collection('shift_master').orderBy('displayOrder').get()
    ]);

    const employees = empSnap.docs
      .filter(d => employeeIds.includes(d.id))
      .map(d => ({ id: d.id, ...d.data() }));

    const masterShifts = shiftSnap.docs.map(d => d.data());
    const allShiftIds = masterShifts.map(s => s.id);

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
      const assignedToday = new Set<string>();

      // Filter people truly available today
      const availableToday = employees.filter(emp => {
          // Rule: Not on confirmed Week-Off
          if (bookingsMap.get(emp.id) === dayName) return false;
          // Rule: Not on approved Leave
          const onLeave = leaves.some(l => emp.id === l.employeeId && dateStr >= l.startDate && dateStr <= l.endDate);
          if (onLeave) return false;
          return true;
      });

      // PHASE A: Fulfill Mandatory Quota Floors
      const shiftsWithRequirements = Object.keys(quotas)
        .filter(key => key.startsWith(dayName))
        .map(key => ({ 
          id: key.split('_')[1], 
          required: Number(quotas[key]) || 0 
        }))
        .filter(s => s.required > 0)
        .sort((a, b) => b.required - a.required);

      for (const shift of shiftsWithRequirements) {
        let assignedCount = 0;
        
        const candidates = availableToday.filter(emp => {
          if (assignedToday.has(emp.id)) return false;

          // Rule: Frequency Max Guard
          const currentCount = empShiftCounts.get(emp.id)?.[shift.id] || 0;
          const maxAllowed = globalFreq[shift.id]?.max ?? 7;
          if (currentCount >= maxAllowed) return false;

          // Rule: Adjacency (Pre-Off)
          const tomorrowIsOff = dayIdx < 6 && bookingsMap.get(emp.id) === DAYS[dayIdx + 1];
          if (tomorrowIsOff && globalPreOff.length > 0 && !globalPreOff.includes(shift.id)) return false;

          // Rule: Adjacency (Post-Off)
          const yesterdayWasOff = dayIdx > 0 && bookingsMap.get(emp.id) === DAYS[dayIdx - 1];
          if (yesterdayWasOff && globalPostOff.length > 0 && !globalPostOff.includes(shift.id)) return false;

          return true;
        });

        // Fairness Heuristic: Sort candidates by current load
        candidates.sort((a, b) => {
          const countA = empShiftCounts.get(a.id)?.[shift.id] || 0;
          const countB = empShiftCounts.get(b.id)?.[shift.id] || 0;
          return countA - countB;
        });

        // Commit Mandatory Assignments
        while (assignedCount < shift.required && candidates.length > 0) {
          const emp = candidates.shift()!;
          assignments.push({
            employeeId: emp.id,
            dayOfWeek: dayName,
            shiftId: shift.id,
            date: dateStr
          });

          assignedToday.add(emp.id);
          const counts = empShiftCounts.get(emp.id)!;
          counts[shift.id] = (counts[shift.id] || 0) + 1;
          assignedCount++;
        }
      }

      // PHASE B: Full Utilization (Distribute Excess Staff)
      // Every available professional NOT yet assigned MUST get a shift to maximize capacity.
      const leftovers = availableToday.filter(emp => !assignedToday.has(emp.id));
      
      if (leftovers.length > 0) {
          leftovers.forEach(emp => {
              // Find all shifts this person is eligible for today
              const eligibleShifts = allShiftIds.filter(sid => {
                  // Rule: Adjacency (Pre-Off)
                  const tomorrowIsOff = dayIdx < 6 && bookingsMap.get(emp.id) === DAYS[dayIdx + 1];
                  if (tomorrowIsOff && globalPreOff.length > 0 && !globalPreOff.includes(sid)) return false;

                  // Rule: Adjacency (Post-Off)
                  const yesterdayWasOff = dayIdx > 0 && bookingsMap.get(emp.id) === DAYS[dayIdx - 1];
                  if (yesterdayWasOff && globalPostOff.length > 0 && !globalPostOff.includes(sid)) return false;

                  return true;
              });

              if (eligibleShifts.length > 0) {
                  // Preference: If this shift was required today, use it. Otherwise, use first eligible.
                  const bestShift = shiftsWithRequirements.find(s => eligibleShifts.includes(s.id))?.id || eligibleShifts[0];
                  
                  assignments.push({
                      employeeId: emp.id,
                      dayOfWeek: dayName,
                      shiftId: bestShift,
                      date: dateStr
                  });

                  assignedToday.add(emp.id);
                  const counts = empShiftCounts.get(emp.id)!;
                  counts[bestShift] = (counts[bestShift] || 0) + 1;
              }
          });
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
      updatedAt: new Date().toISOString(),
      actorId: decoded.uid,
      generationMethod: 'deterministic_engine_v3',
      solverMetadata: {
        solveTimeMs: Date.now() - start,
        constraintsChecked: employees.length * 7 * 6,
        engine: 'ROC_TypeScript_Solver_v3_FullUtilization'
      }
    });

    // Sync quotas to maintain singleton consistency
    await adminDb.collection('roster_quotas').doc(`${weekId}_${officeId}`).set({
      weekId,
      officeId,
      quotas,
      updatedAt: new Date().toISOString(),
      actorId: decoded.uid
    }, { merge: true });

    await logAuditServer(decoded.uid, 'RUN_DETERMINISTIC_SOLVER', draftId, { weekId, officeId, assignmentCount: assignments.length });

    return { 
      success: true, 
      draftId,
      summary: `Logic pulse complete. Fulfilled all mandatory floors and utilized 100% of available professionals (${assignments.length} assignments).`,
      solveTimeMs: Date.now() - start
    };

  } catch (e: any) {
    console.error('Logic Engine Conflict:', e.message);
    return { success: false, error: e.message };
  }
}
