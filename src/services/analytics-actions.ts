'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';

/**
 * Institutional Regional Analytics Node.
 * Exclusively for SUPER_ADMIN access.
 * Performs server-side aggregation to protect employee PII.
 */

async function getAuthorizedSuperAdmin(idToken: string) {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    const profile = userSnap.data()!;
    if (profile.status !== 'Active' || profile.role !== 'SUPER_ADMIN') return null;
    return { uid: decoded.uid, ...profile };
  } catch (e) {
    return null;
  }
}

export async function getRegionalStatsAction(idToken: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized: Regional access restricted to Super Admin.");

  try {
    const [officesSnap, empSnap, rosterSnap, draftSnap] = await Promise.all([
      adminDb.collection('offices').get(),
      adminDb.collection('employees').where('status', '==', 'Active').get(),
      adminDb.collection('published_rosters').get(),
      adminDb.collection('roster_drafts').where('status', '==', 'draft').get()
    ]);

    const offices = officesSnap.docs.map(d => d.data());
    const totalOffices = offices.length;
    const activeOffices = offices.filter(o => o.status === 'Active').length;
    const totalActiveStaff = empSnap.size;

    let totalAssignments = 0;
    rosterSnap.docs.forEach(d => {
      const validAssignments = (d.data().assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned');
      totalAssignments += validAssignments.length;
    });

    return {
      success: true,
      data: {
        totalOffices,
        activeOffices,
        inactiveOffices: totalOffices - activeOffices,
        totalActiveStaff,
        publishedRostersCount: rosterSnap.size,
        draftRostersCount: draftSnap.size,
        totalAssignments,
      }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getOfficeComparisonAction(idToken: string, weekId: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const officesSnap = await adminDb.collection('offices').get();
    const offices = officesSnap.docs.map(d => d.data());

    const results = await Promise.all(offices.map(async (office) => {
      const officeId = office.officeId;
      const localizedQuotaId = `${weekId}_${officeId}`;

      const [empSnap, rosterSnap, quotaSnap, bookSnap, draftSnap] = await Promise.all([
        adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
        adminDb.collection('published_rosters').where('weekId', '==', weekId).where('office', '==', officeId).limit(1).get(),
        adminDb.collection('roster_quotas').doc(localizedQuotaId).get(),
        adminDb.collection('weekoff_bookings').where('weekId', '==', weekId).where('office', '==', officeId).get(),
        adminDb.collection('roster_drafts').where('weekId', '==', weekId).where('office', '==', officeId).get()
      ]);

      const staffCount = empSnap.size;
      const roster = rosterSnap.docs[0]?.data();
      const quota = quotaSnap.exists ? quotaSnap.data() : null;
      
      let requiredCount = 0;
      if (quota?.quotas) {
        requiredCount = Object.values(quota.quotas as Record<string, number>).reduce((a, b) => a + (Number(b) || 0), 0);
      }

      const validAssignments = (roster?.assignments || []).filter((a: any) => a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned');
      const assignedCount = validAssignments.length;
      
      const coverage = quotaSnap.exists 
        ? (requiredCount > 0 ? Math.round((assignedCount / requiredCount) * 100) : (assignedCount > 0 ? 100 : 0))
        : null;

      return {
        officeId,
        officeName: office.officeName,
        shortCode: office.shortCode,
        status: office.status,
        staffCount,
        requiredCount,
        assignedCount,
        coverage,
        shortfall: Math.max(0, requiredCount - assignedCount),
        bookingsCount: bookSnap.size,
        draftCount: draftSnap.size,
      };
    }));

    return { success: true, data: results };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getRegionalRosterAnalyticsAction(idToken: string, weekId: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const rosterSnap = await adminDb.collection('published_rosters').where('weekId', '==', weekId).get();
    const quotaSnap = await adminDb.collection('roster_quotas').where('weekId', '==', weekId).get();
    
    const rosters = rosterSnap.docs.map(d => d.data());
    const quotas = quotaSnap.docs.map(d => d.data());

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dailyCoverage = DAYS.map(day => {
      let dayRequired = 0;
      let dayAssigned = 0;

      quotas.forEach(q => {
        Object.entries(q.quotas || {}).forEach(([key, val]) => {
          if (key.split('_')[0] === day) dayRequired += (Number(val) || 0);
        });
      });

      rosters.forEach(r => {
        const dayAssignments = (r.assignments || []).filter((a: any) => a.dayOfWeek === day && a.shiftId && a.shiftId !== 'none' && a.shiftId !== 'unassigned');
        dayAssigned += dayAssignments.length;
      });

      return {
        day: day.substring(0, 3),
        required: dayRequired,
        assigned: dayAssigned,
        coverage: dayRequired > 0 ? Math.round((dayAssigned / dayRequired) * 100) : (dayAssigned > 0 ? 100 : 0)
      };
    });

    return { success: true, data: { dailyCoverage } };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getRegionalLeaveAnalyticsAction(idToken: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const leaveSnap = await adminDb.collection('employee_leaves').get();
    const leaves = leaveSnap.docs.map(d => d.data());

    const stats = {
      approved: leaves.filter(l => l.status === 'approved').length,
      pending: leaves.filter(l => l.status === 'pending').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
    };

    return { success: true, data: stats };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
