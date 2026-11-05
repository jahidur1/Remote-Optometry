
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * ROC WORKFORCE — SECURE ROSTER ACTIONS
 * 
 * Access Control: Role-based (EMPLOYEE restricted to own data)
 * Privacy: Server-side projection (Zero exposure of peer schedules)
 */

/**
 * getMyRosterAction
 * Retrieves the published assignments for the authenticated professional for a specific week.
 */
export async function getMyRosterAction(idToken: string, weekId: string) {
  if (!idToken) throw new Error("Authentication token missing.");
  
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) throw new Error("Professional profile not found.");
    const profile = userSnap.data()!;
    const employeeId = profile.employeeId;
    const office = profile.office;

    if (!employeeId || !office) throw new Error("Registry Error: Profile incomplete.");

    // Fetch the latest published roster for this week and office
    // LOG: Cycle Pulse Trace
    console.log(`[ACTION:GET_ROSTER] Week=${weekId} Office=${office} Employee=${employeeId}`);

    const rosterSnap = await adminDb.collection('published_rosters')
      .where('weekId', '==', weekId)
      .where('office', '==', office)
      .where('status', '==', 'active')
      .orderBy('publishedAt', 'desc')
      .limit(1)
      .get();

    if (rosterSnap.empty) {
      return { success: true, assignments: [], published: false };
    }

    const rosterData = rosterSnap.docs[0].data();
    
    // SECURITY PROJECT: Filter assignments server-side. 
    // The employee NEVER sees the raw document containing other staff schedules.
    const myAssignments = (rosterData.assignments || []).filter((a: any) => 
      String(a.employeeId) === String(employeeId)
    );

    return { 
      success: true, 
      assignments: myAssignments, 
      published: true,
      publishedAt: rosterData.publishedAt,
      version: rosterData.version
    };

  } catch (e: any) {
    console.error('Secure Roster Fetch Failure:', e.message);
    return { success: false, error: e.message };
  }
}
