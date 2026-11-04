'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * ROC WORKFORCE — INSTITUTIONAL ANALYTICS ENGINE
 * 
 * Access Control: STRICT SUPER_ADMIN ONLY
 * Scope: Regional (All Cluster Nodes)
 * Data Policy: Aggregated Metrics (No employee PII)
 */

async function getAuthorizedSuperAdmin(idToken: string) {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    const profile = userSnap.data()!;
    // Requirement: Must be Active and must be SUPER_ADMIN
    if (profile.status !== 'Active' || profile.role !== 'SUPER_ADMIN') return null;
    return { uid: decoded.uid, ...profile };
  } catch (e) {
    return null;
  }
}

/**
 * getRegionalStatsAction
 * Consolidates global KPIs for the executive pulse.
 */
export async function getRegionalStatsAction(idToken: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized: Regional intelligence restricted to Super Admin.");

  try {
    const [officesSnap, empSnap, rosterSnap, draftSnap] = await Promise.all([
      adminDb.collection('offices').get(),
      adminDb.collection('employees').get(),
      adminDb.collection('published_rosters').get(),
      adminDb.collection('roster_drafts').where('status', '==', 'draft').get()
    ]);

    const offices = officesSnap.docs.map(d => d.data());
    const totalOffices = offices.length;
    const activeOffices = offices.filter(o => o.status === 'Active').length;
    
    const employees = empSnap.docs.map(d => d.data());
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'Active').length;

    let totalAssignments = 0;
    rosterSnap.docs.forEach(d => {
      const data = d.data();
      const valid = (data.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none');
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
 * Detailed matrix of ROC performance for a specific cycle.
 */
export async function getOfficeComparisonAction(idToken: string, weekId: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const officesSnap = await adminDb.collection('offices').get();
    const offices = officesSnap.docs.map(d => d.data());

    const comparisonData = await Promise.all(offices.map(async (office) => {
      const officeId = office.officeId;
      const localizedQuotaId = `${weekId}_${officeId}`;

      const [empSnap, rosterSnap, quotaSnap, bookSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('published_rosters').where('weekId', '==', weekId).where('office', '==', officeId).orderBy('publishedAt', 'desc').limit(1).get(),
        adminDb.collection('roster_quotas').doc(localizedQuotaId).get(),
        adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get()
      ]);

      const staffCount = empSnap.size;
      const roster = rosterSnap.docs[0]?.data();
      const quota = quotaSnap.exists ? quotaSnap.data() : null;
      
      let requiredCount = 0;
      if (quota?.quotas) {
        requiredCount = Object.values(quota.quotas as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
      }

      const validAssignments = (roster?.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none');
      const assignedCount = validAssignments.length;
      
      // Coverage = Assigned / Required. If Required is 0 or missing, handle carefully.
      const coverage = quotaSnap.exists 
        ? (requiredCount > 0 ? Math.round((assignedCount / requiredCount) * 100) : (assignedCount > 0 ? 100 : 0))
        : null; // null indicates configuration missing

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
 * Deep dive into regional deployment patterns.
 */
export async function getRegionalRosterAnalyticsAction(idToken: string, weekId: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

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

      quotaSnap.docs.forEach(q => {
        const quotas = q.data().quotas || {};
        Object.entries(quotas).forEach(([key, val]) => {
          if (key.startsWith(day)) dayRequired += (Number(val) || 0);
        });
      });

      rosterSnap.docs.forEach(r => {
        const assignments = r.data().assignments || [];
        const dayValid = assignments.filter((a: any) => a.dayOfWeek === day && a.shiftId && a.shiftId !== 'none');
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
 * Absence pressure analysis.
 */
export async function getRegionalLeaveAnalyticsAction(idToken: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

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

    return {
      success: true,
      data: {
        total: leaves.length,
        statusBreakdown,
        typeBreakdown
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}