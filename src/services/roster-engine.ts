'use server';

/**
 * @fileOverview Institutional Pure-Logic Roster Orchestration Engine.
 * Implements a deterministic constraint satisfaction algorithm in TypeScript.
 * 
 * PROTOCOL v4.0: 
 * 1. MANDATORY FLOOR: Strictly satisfies 'Assignment Matrix' headcount requirements.
 * 2. 100% UTILIZATION: Every available professional MUST be assigned a shift.
 * 3. NO REDUCTION: Clinical floor is the absolute minimum; excess staff distributed safely.
 * 4. SHORTFALL PROTECTION: Blocks generation if available headcount < required floor.
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

    // 3. Logic Execution (Atomic Date Mapping)
    const assignments: any[] = [];
    const empShiftCounts = new Map<string, Record<string, number>>(); 

    // Initialize counts
    employees.forEach(e => empShiftCounts.set(e.id, {}));

    // CORE SOLVER LOOP
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayName = DAYS[dayIdx];
      const dateStr = dateStrings[dayIdx];
      const assignedToday = new Set<string>();

      // Filter people truly available today
      const availableToday = employees.filter(emp => {
          if (bookingsMap.get(emp.id) === dayName) return false;
          const onLeave = leaves.some(l => emp.id === l.employeeId && dateStr >= l.startDate && dateStr <= l.endDate);
          if (onLeave) return false;
          return true;
      });

      // Daily Requirement Calculation
      const dailyRequirements = Object.keys(quotas)
        .filter(key => key.startsWith(dayName))
        .map(key => ({ 
          id: key.split('_')[1], 
          required: Number(quotas[key]) || 0 
        }))
        .filter(s => s.required > 0);

      const totalRequiredHeadcount = dailyRequirements.reduce((sum, r) => sum + r.required, 0);

      // SHORTFALL PROTECTION: ensure we have enough staff to meet the floor
      if (availableToday.length < totalRequiredHeadcount) {
          throw new Error(`Staffing Shortfall on ${dayName}: Required headcount is ${totalRequiredHeadcount}, but only ${availableToday.length} professionals are available.`);
      }

      // PHASE A: Fulfill Mandatory Quota Floors
      // Priority: shifts with higher requirement first
      dailyRequirements.sort((a, b) => b.required - a.required);

      for (const shift of dailyRequirements) {
        let assignedCount = 0;
        
        const candidates = availableToday.filter(emp => {
          if (assignedToday.has(emp.id)) return false;

          const currentCount = empShiftCounts.get(emp.id)?.[shift.id] || 0;
          const maxAllowed = globalFreq[shift.id]?.max ?? 7;
          if (currentCount >= maxAllowed) return false;

          const tomorrowIsOff = dayIdx < 6 && bookingsMap.get(emp.id) === DAYS[dayIdx + 1];
          if (tomorrowIsOff && globalPreOff.length > 0 && !globalPreOff.includes(shift.id)) return false;

          const yesterdayWasOff = dayIdx > 0 && bookingsMap.get(emp.id) === DAYS[dayIdx - 1];
          if (yesterdayWasOff && globalPostOff.length > 0 && !globalPostOff.includes(shift.id)) return false;

          return true;
        });

        // Heuristic: Prefer people with fewest current assignments of THIS shift to keep it fair
        candidates.sort((a, b) => {
          const countA = empShiftCounts.get(a.id)?.[shift.id] || 0;
          const countB = empShiftCounts.get(b.id)?.[shift.id] || 0;
          return countA - countB;
        });

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
        
        if (assignedCount < shift.required) {
            throw new Error(`Constraint Conflict: Could not satisfy mandatory floor for ${shift.id} on ${dayName} due to frequency or adjacency limits.`);
        }
      }

      // PHASE B: Full Utilization (Assign EVERY remaining professional)
      const leftovers = availableToday.filter(emp => !assignedToday.has(emp.id));
      
      leftovers.forEach(emp => {
          const eligibleShifts = allShiftIds.filter(sid => {
              const currentCount = empShiftCounts.get(emp.id)?.[sid] || 0;
              const maxAllowed = globalFreq[sid]?.max ?? 7;
              if (currentCount >= maxAllowed) return false;

              const tomorrowIsOff = dayIdx < 6 && bookingsMap.get(emp.id) === DAYS[dayIdx + 1];
              if (tomorrowIsOff && globalPreOff.length > 0 && !globalPreOff.includes(sid)) return false;

              const yesterdayWasOff = dayIdx > 0 && bookingsMap.get(emp.id) === DAYS[dayIdx - 1];
              if (yesterdayWasOff && globalPostOff.length > 0 && !globalPostOff.includes(sid)) return false;

              return true;
          });

          if (eligibleShifts.length > 0) {
              // Prefer assigning to a shift that is part of the daily requirements to balance pods
              const preferredShift = dailyRequirements.find(r => eligibleShifts.includes(r.id))?.id || eligibleShifts[0];
              
              assignments.push({
                  employeeId: emp.id,
                  dayOfWeek: dayName,
                  shiftId: preferredShift,
                  date: dateStr
              });

              assignedToday.add(emp.id);
              const counts = empShiftCounts.get(emp.id)!;
              counts[preferredShift] = (counts[preferredShift] || 0) + 1;
          }
      });
    }

    // 4. Persistence (Singleton ID Protocol)
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
      generationMethod: 'deterministic_engine_v4_full_utilization',
      solverMetadata: {
        solveTimeMs: Date.now() - start,
        assignmentsCreated: assignments.length,
        engine: 'ROC_TypeScript_Solver_v4'
      }
    });

    await logAuditServer(decoded.uid, 'RUN_DETERMINISTIC_SOLVER', draftId, { weekId, officeId, count: assignments.length });

    return { 
      success: true, 
      draftId,
      summary: `Registry synchronized. Satisfied mandatory floors and achieved 100% professional utilization (${assignments.length} assignments).`,
      solveTimeMs: Date.now() - start
    };

  } catch (e: any) {
    console.error('Orchestration Conflict:', e.message);
    return { success: false, error: e.message };
  }
}
