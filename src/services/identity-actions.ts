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

/**
 * provisionIdentityAction
 * Hardened: Performs triple-uniqueness check (ID, Email, Phone).
 */
export async function provisionIdentityAction(idToken: string, formData: any, password: string) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized: Administrative pulse required.");

  // 1. Dynamic Office Validation
  await assertOfficeActive(formData.office);

  // 2. Authorization Scoping
  if (caller.role === 'ADMIN' && !caller.officeIds.includes(formData.office)) {
    throw new Error(`Unauthorized: You cannot provision staff for cluster ${formData.office}.`);
  }

  const employeeId = formData.employeeId.toUpperCase();
  const email = formData.email.toLowerCase();
  const phoneFormatted = `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`;

  try {
    // Triple Uniqueness Check
    const [idSnap, emailSnap, phoneSnap] = await Promise.all([
      adminDb.collection('employees').doc(employeeId).get(),
      adminDb.collection('employees').where('email', '==', email).get(),
      adminDb.collection('employees').where('whatsappNumber', '==', phoneFormatted).get()
    ]);

    if (idSnap.exists) throw new Error("Identity Lock: Employee ID already registered.");
    if (!emailSnap.empty) throw new Error("Identity Lock: Email already bound to a record.");
    if (!phoneSnap.empty) throw new Error("Identity Lock: Mobile endpoint already bound to a record.");

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
      officeIds: [formData.office],
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
    await logAuditServer(caller.uid, 'ADMIN_PROVISION_IDENTITY', employeeId, { role: formData.role });

    return { success: true, uid: authUser.uid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * updateAccountStatusAction
 */
export async function updateAccountStatusAction(idToken: string, employeeId: string, newStatus: string) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const empData = empSnap.data()!;

    if (empData.role === 'SUPER_ADMIN' && caller.role !== 'SUPER_ADMIN') {
      throw new Error("Privilege Block: Only Super Admins can modify other Super Admins.");
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
    }

    await batch.commit();

    if (empData.authUid) {
      try {
        await adminAuth.updateUser(empData.authUid, { disabled: newStatus === 'Suspended' });
      } catch (authErr) {}
    }

    await logAuditServer(caller.uid, `ADMIN_${newStatus.toUpperCase()}_IDENTITY`, employeeId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * updateEmployeeRecordAction
 */
export async function updateEmployeeRecordAction(idToken: string, employeeId: string, updates: any) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const current = empSnap.data()!;

    const allowed = ['fullName', 'whatsappNumber', 'department', 'designation', 'age', 'gender'];
    const filtered: any = {};
    allowed.forEach(key => { if (updates[key] !== undefined) filtered[key] = updates[key]; });

    if (caller.role === 'SUPER_ADMIN') {
      if (updates.role) filtered.role = updates.role;
      if (updates.status) filtered.status = updates.status;
      
      if (updates.office) {
        await assertOfficeActive(updates.office);
        filtered.office = updates.office;
      }
      
      if (updates.officeIds) {
        for (const oId of updates.officeIds) {
          await assertOfficeActive(oId);
        }
        filtered.officeIds = updates.officeIds;
      }
    }

    if (updates.email && updates.email !== current.email) {
      if (caller.role !== 'SUPER_ADMIN') throw new Error("Privilege Block: Email updates restricted to Super Admin.");
      await adminAuth.updateUser(current.authUid, { email: updates.email });
      filtered.email = updates.email;
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
    await logAuditServer(caller.uid, 'ADMIN_UPDATE_IDENTITY', employeeId, { updatedFields: Object.keys(filtered) });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
