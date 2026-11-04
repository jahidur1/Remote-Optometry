
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';

/**
 * Institutional Office Registry Actions.
 * Exclusively available to active super_admins.
 */

async function getAuthorizedSuperAdmin(idToken: string) {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    const profile = userSnap.data()!;
    if (profile.status !== 'Active' || profile.role !== 'super_admin') return null;
    return { uid: decoded.uid, ...profile };
  } catch (e) {
    return null;
  }
}

export async function createOfficeAction(idToken: string, officeData: any) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized: Super Admin pulse required.");

  const { officeId, officeName, shortCode, city, state, country } = officeData;

  if (!officeId || !officeName || !shortCode) {
    throw new Error("Validation Error: Missing mandatory registry fields.");
  }

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const officeRef = adminDb.collection('offices').doc(officeId);
      const shortCodeRef = adminDb.collection('registry_short_codes').doc(shortCode.toUpperCase());

      const [officeSnap, codeSnap] = await Promise.all([
        transaction.get(officeRef),
        transaction.get(shortCodeRef)
      ]);

      if (officeSnap.exists) throw new Error(`Registry Conflict: Office ID ${officeId} already exists.`);
      if (codeSnap.exists) throw new Error(`Registry Conflict: Short Code ${shortCode} already reserved.`);

      const now = new Date().toISOString();
      const newOffice = {
        officeId,
        officeName,
        shortCode: shortCode.toUpperCase(),
        city: city || '',
        state: state || '',
        country: country || 'India',
        status: 'Active',
        createdAt: now,
        createdBy: caller.uid,
        updatedAt: now
      };

      transaction.set(officeRef, newOffice);
      transaction.set(shortCodeRef, { officeId, reservedAt: now });

      await logAuditServer(caller.uid, 'ADMIN_CREATE_OFFICE', officeId, { shortCode });
      return { success: true, officeId };
    });
  } catch (e: any) {
    console.error('Office Provisioning Failure:', e);
    return { success: false, error: e.message };
  }
}

export async function updateOfficeAction(idToken: string, officeId: string, updates: any) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  const allowed = ['officeName', 'city', 'state', 'country'];
  const filtered: any = { updatedAt: new Date().toISOString() };
  allowed.forEach(key => { if (updates[key]) filtered[key] = updates[key]; });

  try {
    await adminDb.collection('offices').doc(officeId).update(filtered);
    await logAuditServer(caller.uid, 'ADMIN_UPDATE_OFFICE', officeId, { fields: Object.keys(filtered) });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function setOfficeStatusAction(idToken: string, officeId: string, status: 'Active' | 'Inactive') {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    await adminDb.collection('offices').doc(officeId).update({ 
      status, 
      updatedAt: new Date().toISOString() 
    });
    await logAuditServer(caller.uid, `ADMIN_SET_OFFICE_${status.toUpperCase()}`, officeId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Idempotent seed for the three original ROC units.
 */
export async function seedOriginalOfficesAction(idToken: string) {
  const caller = await getAuthorizedSuperAdmin(idToken);
  if (!caller) throw new Error("Unauthorized.");

  const originals = [
    { officeId: 'KOLKATA_ROC', officeName: 'Kolkata ROC', shortCode: 'KOL', city: 'Kolkata', state: 'West Bengal' },
    { officeId: 'GURGAON_ROC', officeName: 'Gurgaon ROC', shortCode: 'GGN', city: 'Gurugram', state: 'Haryana' },
    { officeId: 'LUCKNOW_ROC', officeName: 'Lucknow ROC', shortCode: 'LKO', city: 'Lucknow', state: 'Uttar Pradesh' }
  ];

  const results = [];
  for (const office of originals) {
    const res = await createOfficeAction(idToken, office);
    results.push({ officeId: office.officeId, ...res });
  }
  return results;
}
