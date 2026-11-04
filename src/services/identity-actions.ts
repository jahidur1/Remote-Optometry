
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logAuditServer } from './audit-service';
import { assertOfficeActive } from '@/lib/office-utils';

/**
 * Hardened Server-Side Authorization Utility
 * Re-verifies token and matches requested office against authorized officeIds.
 */
async function getAuthorizedCaller(idToken: string, requestedOfficeId?: string) {
  if (!idToken) throw new Error("Unauthorized: Session pulse missing.");
  
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) throw new Error("Unauthorized: Identity node not found.");
    const profile = userSnap.data()!;
    
    if (profile.status !== 'Active') throw new Error("Unauthorized: Account suspended.");
    if (!['ADMIN', 'SUPER_ADMIN'].includes(profile.role)) throw new Error("Unauthorized: Elevated pulse required.");

    const authorizedOffices = profile.officeIds || (profile.office ? [profile.office] : []);

    if (requestedOfficeId && profile.role !== 'SUPER_ADMIN') {
      if (!authorizedOffices.includes(requestedOfficeId)) {
        throw new Error(`Forbidden: You are not authorized for cluster ${requestedOfficeId}.`);
      }
    }
    
    return { 
      uid: decoded.uid, 
      ...profile,
      authorizedOffices
    };
  } catch (e: any) {
    console.error('Authorization Pulse Failure:', e.message);
    throw e;
  }
}

/**
 * provisionIdentityAction
 * Hardened: Performs triple-uniqueness check (ID, Email, Phone) via parallel atomic lookups.
 */
export async function provisionIdentityAction(idToken: string, formData: any, password: string) {
  const caller = await getAuthorizedCaller(idToken, formData.office);

  // 1. Dynamic Registry Validation
  await assertOfficeActive(formData.office);

  const employeeId = formData.employeeId.toUpperCase().trim();
  const email = formData.email.toLowerCase().trim();
  const phoneFormatted = `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`;

  try {
    // 2. Uniqueness Check
    const [idSnap, emailSnap, phoneSnap] = await Promise.all([
      adminDb.collection('employees').doc(employeeId).get(),
      adminDb.collection('employees').where('email', '==', email).get(),
      adminDb.collection('employees').where('whatsappNumber', '==', phoneFormatted).get()
    ]);

    if (idSnap.exists) throw new Error("Identity Lock: Employee ID already registered.");
    if (!emailSnap.empty) throw new Error("Identity Lock: Email already bound.");
    if (!phoneSnap.empty) throw new Error("Identity Lock: Mobile already bound.");

    // 3. Provision Node
    const authUser = await adminAuth.createUser({
      email,
      password,
      displayName: formData.fullName,
      phoneNumber: phoneFormatted,
      emailVerified: false
    });

    const commonData = {
      fullName: formData.fullName,
      email,
      whatsappNumber: phoneFormatted,
      role: formData.role,
      office: formData.office,
      status: 'Active',
      updatedAt: new Date().toISOString()
    };

    const batch = adminDb.batch();
    
    batch.set(adminDb.collection('employees').doc(employeeId), {
      ...commonData,
      id: employeeId,
      gender: formData.gender,
      department: formData.department,
      designation: formData.designation,
      joinedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      authUid: authUser.uid
    });

    batch.set(adminDb.collection('users').doc(authUser.uid), {
      ...commonData,
      uid: authUser.uid,
      displayName: formData.fullName,
      employeeId,
      phoneNumber: phoneFormatted,
      lastLogin: new Date().toISOString()
    });

    await batch.commit();
    await logAuditServer(caller.uid, 'ADMIN_PROVISION_IDENTITY', employeeId, { office: formData.office });

    return { success: true, uid: authUser.uid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * updateAccountStatusAction
 */
export async function updateAccountStatusAction(idToken: string, employeeId: string, newStatus: string) {
  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const empData = empSnap.data()!;

    // Verify caller is authorized for this employee's office
    const caller = await getAuthorizedCaller(idToken, empData.office);

    if (empData.role === 'SUPER_ADMIN' && caller.role !== 'SUPER_ADMIN') {
      throw new Error("Privilege Block: Super Admin only.");
    }

    const batch = adminDb.batch();
    batch.update(adminDb.collection('employees').doc(employeeId), { 
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    if (empData.authUid) {
      batch.update(adminDb.collection('users').doc(empData.authUid), { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      await adminAuth.updateUser(empData.authUid, { disabled: newStatus === 'Suspended' });
    }

    await batch.commit();
    await logAuditServer(caller.uid, `ADMIN_SET_STATUS_${newStatus.toUpperCase()}`, employeeId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * updateEmployeeRecordAction
 */
export async function updateEmployeeRecordAction(idToken: string, employeeId: string, updates: any) {
  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const current = empSnap.data()!;

    const caller = await getAuthorizedCaller(idToken, current.office);

    const allowed = ['fullName', 'whatsappNumber', 'department', 'designation', 'age', 'gender'];
    const filtered: any = {};
    allowed.forEach(key => { if (updates[key] !== undefined) filtered[key] = updates[key]; });

    // Restrict identity fields for non-Super Admins
    if (caller.role !== 'SUPER_ADMIN') {
      delete filtered.role;
      delete filtered.status;
      delete filtered.office;
    }

    const batch = adminDb.batch();
    batch.update(adminDb.collection('employees').doc(employeeId), {
      ...filtered,
      updatedAt: new Date().toISOString()
    });

    if (current.authUid) {
      const userUpdates: any = { updatedAt: new Date().toISOString(), ...filtered };
      if (filtered.fullName) userUpdates.displayName = filtered.fullName;
      batch.update(adminDb.collection('users').doc(current.authUid), userUpdates);
    }

    await batch.commit();
    await logAuditServer(caller.uid, 'ADMIN_UPDATE_IDENTITY', employeeId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
