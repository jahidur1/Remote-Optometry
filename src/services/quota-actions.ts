
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logAuditServer } from './audit-service';
import { assertOfficeActive } from '@/lib/office-utils';

/**
 * Verifies the caller's identity and administrative role on the server.
 */
async function getAuthorizedCaller(idToken: string) {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) return null;
    const profile = userSnap.data()!;
    
    if (profile.status !== 'Active' || !['ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
      return null;
    }
    
    return { 
      uid: decoded.uid, 
      ...profile,
      officeIds: profile.officeIds || (profile.office ? [profile.office] : [])
    };
  } catch (e) {
    return null;
  }
}

export type SaveQuotaInput = {
  weekId: string;
  officeId: string;
  quotas: Record<string, number>;
  genderTargets?: Record<string, any>;
};

/**
 * saveQuotaAction
 * Refactored: Uses dynamic Office Registry.
 */
export async function saveQuotaAction(idToken: string, payload: SaveQuotaInput) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized: Administrative pulse required.");

  const { weekId, officeId, quotas, genderTargets } = payload;

  if (!weekId || !officeId) {
    throw new Error("Validation Error: weekId and officeId are required.");
  }

  // 1. Dynamic Registry Validation
  await assertOfficeActive(officeId);

  // 2. Authorization Scoping
  if (caller.role === 'ADMIN' && !caller.officeIds.includes(officeId)) {
    throw new Error(`Access Denied: You are not authorized to configure quotas for ${officeId}.`);
  }

  try {
    const localizedId = `${weekId}_${officeId}`;
    const quotaRef = adminDb.collection('roster_quotas').doc(localizedId);

    const docData = {
      weekId,
      officeId,
      quotas: quotas || {},
      genderTargets: genderTargets || {},
      updatedAt: new Date().toISOString(),
      actorId: caller.uid
    };

    await quotaRef.set(docData, { merge: true });
    await logAuditServer(caller.uid, 'CONFIGURE_ROSTER_QUOTAS_OFFICE', localizedId, { 
      quotaCount: Object.keys(quotas || {}).length 
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
