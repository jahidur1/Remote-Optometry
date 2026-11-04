
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * ROC WORKFORCE — INSTITUTIONAL ANALYTICS ENGINE
 * 
 * Access Control: STRICT SUPER_ADMIN ONLY for regional, ADMIN for office-specific
 * Scope: Regional (All Cluster Nodes) or Local (Specific Office)
 */

async function getAuthorizedProfile(idToken: string) {
  if (!idToken) throw new Error("Authentication token missing.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Profile not found.");
  return { uid: decoded.uid, ...userSnap.data() } as any;
}

/**
 * getRegionalStatsAction
 * Enhanced with pending counts and shortfall analysis for Super Admin Command Center.
 */
export async function getRegionalStatsAction(idToken: string) {
  const profile = await getAuthorizedProfile(idToken);
  if (profile.status !== 'Active' || profile.role !== 'super_admin') {
    throw new Error("Unauthorized: Super Admin access only.");
  }

  try {
    const [officesSnap, empSnap, rosterSnap, draftSnap, swapsSnap, leavesSnap] = await Promise.all([
      adminDb.collection('offices').get(),
      adminDb.collection('employees').get(),
      adminDb.collection('published_rosters').get(),
      adminDb.collection('roster_drafts').where('status', '==', 'draft').get(),
      adminDb.collection('shift_swaps').where('status', '==', 'pending').get(),
      adminDb.collection('employee_leaves').where('status', '==', 'pending').get()
    ]);

    const totalOffices = officesSnap.size;
    const activeOffices = officesSnap.docs.filter(d => d.data().status === 'Active').length;
    const activeEmployees = empSnap.docs.filter(d => d.data().status === 'Active').length;

    let totalAssignments = 0;
    rosterSnap.docs.forEach(d => {
      const valid = (d.data().assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none');
      totalAssignments += valid.length;
    });

    return {
      success: true,
      data: {
        totalOffices,
        activeOffices,
        inactiveOffices: totalOffices - activeOffices,
        totalEmployees: empSnap.size,
        activeEmployees,
        totalPublishedRosters: rosterSnap.size,
        totalAssignments,
        totalDrafts: draftSnap.size,
        pendingSwaps: swapsSnap.size,
        pendingLeaves: leavesSnap.size,
        timestamp: new Date().toISOString()
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * getOfficeDashboardStatsAction
 * Consolidates KPIs for a specific office context (Admin view).
 */
export async function getOfficeDashboardStatsAction(idToken: string, officeId: string) {
  const profile = await getAuthorizedProfile(idToken);
  const authorizedOffices = profile.officeIds || (profile.office ? [profile.office] : []);
  
  if (profile.status !== 'Active' || (profile.role !== 'super_admin' && !authorizedOffices.includes(officeId))) {
    throw new Error("Unauthorized: Office access denied.");
  }

  try {
    const [empSnap, rosterSnap, swapsSnap, leavesSnap, prefsSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).get(),
      adminDb.collection('published_rosters').where('office', '==', officeId).orderBy('publishedAt', 'desc').limit(1).get(),
      adminDb.collection('shift_swaps').where('office', '==', officeId).where('status', '==', 'pending').get(),
      adminDb.collection('employee_leaves').where('office', '==', officeId).where('status', '==', 'pending').get(),
      adminDb.collection('employee_preferences').where('office', '==', officeId).get()
    ]);

    const activeEmps = empSnap.docs.filter(d => d.data().status === 'Active').length;
    const roster = rosterSnap.docs[0]?.data();
    const assignedCount = (roster?.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none').length;

    return {
      success: true,
      data: {
        totalEmployees: empSnap.size,
        activeEmployees: activeEmps,
        inactiveEmployees: empSnap.size - activeEmps,
        assignedCount,
        pendingSwaps: swapsSnap.size,
        pendingLeaves: leavesSnap.size,
        pendingPrefs: prefsSnap.size,
        rosterVersion: roster?.version || null,
        timestamp: new Date().toISOString()
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getOfficeComparisonAction(idToken: string, weekId: string) {
  const profile = await getAuthorizedProfile(idToken);
  if (profile.status !== 'Active' || profile.role !== 'super_admin') {
    throw new Error("Unauthorized.");
  }

  try {
    const officesSnap = await adminDb.collection('offices').get();
    const offices = officesSnap.docs.map(d => d.data());

    const comparisonData = await Promise.all(offices.map(async (office) => {
      const officeId = office.officeId;
      const localizedQuotaId = `${weekId}_${officeId}`;

      const [empSnap, rosterSnap, quotaSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('published_rosters').where('weekId', '==', weekId).where('office', '==', officeId).orderBy('publishedAt', 'desc').limit(1).get(),
        adminDb.collection('roster_quotas').doc(localizedQuotaId).get()
      ]);

      const quotaData = quotaSnap.exists ? quotaSnap.data() : null;
      let requiredCount = 0;
      if (quotaData?.quotas) {
        requiredCount = Object.values(quotaData.quotas as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
      }

      const assignedCount = (rosterSnap.docs[0]?.data()?.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none').length;
      const coverage = quotaSnap.exists ? (requiredCount > 0 ? Math.round((assignedCount / requiredCount) * 100) : 100) : null;

      return {
        officeId,
        officeName: office.officeName,
        shortCode: office.shortCode,
        staffCount: empSnap.size,
        requiredCount,
        assignedCount,
        coverage,
        shortfall: Math.max(0, requiredCount - assignedCount),
        status: office.status
      };
    }));

    return { success: true, data: comparisonData };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getRegionalRosterAnalyticsAction(idToken: string, weekId: string) {
  const profile = await getAuthorizedProfile(idToken);
  if (profile.status !== 'Active' || profile.role !== 'super_admin') throw new Error("Unauthorized.");

  try {
    const [rosterSnap, quotaSnap] = await Promise.all([
      adminDb.collection('published_rosters').where('weekId', '==', weekId).get(),
      adminDb.collection('roster_quotas').where('weekId', '==', weekId).get()
    ]);

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dailyStats = DAYS.map(day => {
      let required = 0;
      let assigned = 0;

      quotaSnap.docs.forEach(q => {
        const quotas = q.data().quotas || {};
        Object.entries(quotas).forEach(([key, val]) => {
          if (key.startsWith(day)) required += (Number(val) || 0);
        });
      });

      rosterSnap.docs.forEach(r => {
        const assignments = r.data().assignments || [];
        assigned += assignments.filter((a: any) => a.dayOfWeek === day && a.shiftId && a.shiftId !== 'none').length;
      });

      return { day, short: day.substring(0, 3), required, assigned };
    });

    return { success: true, data: { dailyStats } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getRegionalLeaveAnalyticsAction(idToken: string) {
  const profile = await getAuthorizedProfile(idToken);
  if (profile.status !== 'Active' || profile.role !== 'super_admin') throw new Error("Unauthorized.");

  try {
    const leaveSnap = await adminDb.collection('employee_leaves').get();
    const leaves = leaveSnap.docs.map(d => d.data());

    const statusBreakdown = {
      approved: leaves.filter(l => l.status === 'approved').length,
      pending: leaves.filter(l => l.status === 'pending').length,
      rejected: leaves.filter(l => l.status === 'rejected').length
    };

    return { success: true, data: { statusBreakdown } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
