'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * ROC WORKFORCE — INSTITUTIONAL ANALYTICS ENGINE (PHASE 3.2)
 * 
 * Access Control: STRICT SUPER_ADMIN ONLY
 * Scope: Regional (All Cluster Nodes, Active and Inactive)
 * Data Policy: Aggregated Metrics (Zero PII Leakage)
 */

/**
 * Verifies the caller's identity and confirms active SUPER_ADMIN status.
 * This is the primary security gate for all regional analytics.
 */
async function getAuthorizedSuperAdmin(idToken: string) {
  if (!idToken) throw new Error("Authentication token missing.");
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) throw new Error("Administrative profile not found.");
    const profile = userSnap.data()!;
    
    // STRICT REQUIREMENT: Must be Active AND SUPER_ADMIN
    if (profile.status !== 'Active' || profile.role !== 'SUPER_ADMIN') {
      throw new Error("Unauthorized: Access restricted to active Super Admin nodes.");
    }
    
    return { uid: decoded.uid, ...profile };
  } catch (e: any) {
    console.error('Regional Auth Pulse Failure:', e.message);
    throw new Error(e.message || "Unauthorized.");
  }
}

/**
 * getRegionalStatsAction
 * Consolidates global KPIs for the executive regional pulse.
 */
export async function getRegionalStatsAction(idToken: string) {
  await getAuthorizedSuperAdmin(idToken);

  try {
    const [officesSnap, empSnap, rosterSnap, draftSnap] = await Promise.all([
      adminDb.collection('offices').get(),
      adminDb.collection('employees').get(),
      adminDb.collection('published_rosters').get(),
      adminDb.collection('roster_drafts').where('status', '==', 'draft').get()
    ]);

    const totalOffices = officesSnap.size;
    const activeOffices = officesSnap.docs.filter(d => d.data().status === 'Active').length;
    
    const totalEmployees = empSnap.size;
    const activeEmployees = empSnap.docs.filter(d => d.data().status === 'Active').length;

    let totalAssignments = 0;
    rosterSnap.docs.forEach(d => {
      const data = d.data();
      // Filter out 'none' or 'unassigned' markers to get real deployment count
      const valid = (data.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned');
      totalAssignments += valid.length;
    });

    return {
      success: true,
      data: {
        totalOffices,
        activeOffices,
        inactiveOffices: totalOffices - activeOffices,
        totalEmployees,
        activeEmployees,
        totalPublishedRosters: rosterSnap.size,
        totalDrafts: draftSnap.size,
        totalAssignments,
        timestamp: new Date().toISOString()
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * getOfficeComparisonAction
 * Generates the performance comparison matrix across all ROC nodes for a specific week.
 * Missing quota configuration is explicitly identified.
 */
export async function getOfficeComparisonAction(idToken: string, weekId: string) {
  await getAuthorizedSuperAdmin(idToken);

  try {
    const officesSnap = await adminDb.collection('offices').get();
    const offices = officesSnap.docs.map(d => d.data());

    const comparisonData = await Promise.all(offices.map(async (office) => {
      const officeId = office.officeId;
      const localizedQuotaId = `${weekId}_${officeId}`;

      const [empSnap, rosterSnap, quotaSnap, bookSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('published_rosters')
          .where('weekId', '==', weekId)
          .where('office', '==', officeId)
          .orderBy('publishedAt', 'desc')
          .limit(1)
          .get(),
        adminDb.collection('roster_quotas').doc(localizedQuotaId).get(),
        adminDb.collection('weekoff_bookings')
          .where('weekId', '==', weekId)
          .where('office', '==', officeId)
          .get()
      ]);

      const staffCount = empSnap.size;
      const roster = rosterSnap.docs[0]?.data();
      const quota = quotaSnap.exists ? quotaSnap.data() : null;
      
      let requiredCount = 0;
      if (quota?.quotas) {
        requiredCount = Object.values(quota.quotas as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
      }

      const validAssignments = (roster?.assignments || []).filter((a: any) => 
        a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned'
      );
      const assignedCount = validAssignments.length;
      
      // COVERAGE LOGIC: Handle missing configs distinctly from zero demand
      // If quota doc doesn't exist, we report 'null' so UI can show 'CONFIG_MISSING'
      const coverage = quotaSnap.exists 
        ? (requiredCount > 0 ? Math.round((assignedCount / requiredCount) * 100) : (assignedCount > 0 ? 100 : 0))
        : null; 

      return {
        officeId,
        officeName: office.officeName,
        shortCode: office.shortCode,
        staffCount,
        requiredCount,
        assignedCount,
        coverage,
        shortfall: Math.max(0, requiredCount - assignedCount),
        bookingsCount: bookSnap.size,
        status: office.status
      };
    }));

    return { success: true, data: comparisonData };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * getRegionalRosterAnalyticsAction
 * Provides day-wise trend analysis and shift demand analysis across the region.
 * Distinguishes between Required shifts and Scheduled assignments.
 */
export async function getRegionalRosterAnalyticsAction(idToken: string, weekId: string) {
  await getAuthorizedSuperAdmin(idToken);

  try {
    const [rosterSnap, quotaSnap] = await Promise.all([
      adminDb.collection('published_rosters').where('weekId', '==', weekId).get(),
      adminDb.collection('roster_quotas').where('weekId', '==', weekId).get()
    ]);

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    // Aggregated Daily Map
    const dailyStats = DAYS.map(day => {
      let dayRequired = 0;
      let dayAssigned = 0;

      // Sum all office quotas for this day
      quotaSnap.docs.forEach(q => {
        const quotas = q.data().quotas || {};
        Object.entries(quotas).forEach(([key, val]) => {
          if (key.startsWith(day)) dayRequired += (Number(val) || 0);
        });
      });

      // Sum all assigned shifts for this day (Published rosters only)
      rosterSnap.docs.forEach(r => {
        const assignments = r.data().assignments || [];
        const dayValid = assignments.filter((a: any) => 
          a.dayOfWeek === day && a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned'
        );
        dayAssigned += dayValid.length;
      });

      return {
        day,
        short: day.substring(0, 3),
        required: dayRequired,
        assigned: dayAssigned,
        coverage: dayRequired > 0 ? Math.round((dayAssigned / dayRequired) * 100) : 0
      };
    });

    return { success: true, data: { dailyStats } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * getRegionalLeaveAnalyticsAction
 * Absence and unavailability pressure analysis across all cluster nodes.
 */
export async function getRegionalLeaveAnalyticsAction(idToken: string) {
  await getAuthorizedSuperAdmin(idToken);

  try {
    const leaveSnap = await adminDb.collection('employee_leaves').get();
    const leaves = leaveSnap.docs.map(d => d.data());

    const statusBreakdown = {
      approved: leaves.filter(l => l.status === 'approved').length,
      pending: leaves.filter(l => l.status === 'pending').length,
      rejected: leaves.filter(l => l.status === 'rejected').length
    };

    const typeBreakdown = {
      leave: leaves.filter(l => l.type === 'leave').length,
      training: leaves.filter(l => l.type === 'training').length,
      other: leaves.filter(l => l.type === 'other').length
    };

    // Calculate office-wise pressure (Total approved leaves per office)
    const officePressure: Record<string, number> = {};
    leaves.filter(l => l.status === 'approved').forEach(l => {
      const off = l.office || 'UNMAPPED';
      officePressure[off] = (officePressure[off] || 0) + 1;
    });

    return {
      success: true,
      data: {
        total: leaves.length,
        statusBreakdown,
        typeBreakdown,
        officePressure,
        timestamp: new Date().toISOString()
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
