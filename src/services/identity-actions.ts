
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';
import { assertOfficeActive } from '@/lib/office-utils';

/**
 * Hardened Server-Side Authorization Utility
 * Re-verifies token and matches requested office against authorized officeIds.
 */
async function getAuthorizedCaller(idToken: string, requestedOfficeId?: string) {
  if (!idToken) throw new Error("Unauthorized: Session pulse missing.");
  
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) throw new Error("Unauthorized: Identity node not found.");
    const profile = userSnap.data()!;
    
    if (profile.status !== 'Active') throw new Error("Unauthorized: Account suspended.");
    
    const role = (profile.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'super_admin') {
        throw new Error("Unauthorized: Elevated pulse required.");
    }

    const authorizedOffices = profile.officeIds || (profile.office ? [profile.office] : []);

    if (requestedOfficeId && role !== 'super_admin') {
      if (!authorizedOffices.includes(requestedOfficeId)) {
        throw new Error(`Forbidden: You are not authorized for cluster ${requestedOfficeId}.`);
      }
    }
    
    return { 
      uid: decoded.uid, 
      ...profile,
      role,
      authorizedOffices
    };
  } catch (e: any) {
    console.error('Authorization Pulse Failure:', e.message);
    throw e;
  }
}

/**
 * updateEmployeeRecordAction
 * Hardened: Super Admin can modify ANY user details.
 */
export async function updateEmployeeRecordAction(idToken: string, employeeId: string, updates: any) {
  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const current = empSnap.data()!;

    const caller = await getAuthorizedCaller(idToken, current.office);

    const allowed = ['fullName', 'email', 'whatsappNumber', 'department', 'designation', 'age', 'gender', 'office', 'officeIds', 'role', 'status'];
    const filtered: any = {};
    allowed.forEach(key => { if (updates[key] !== undefined) filtered[key] = updates[key]; });

    // Enforce role normalization
    if (filtered.role) filtered.role = filtered.role.toLowerCase();

    // Privilege Guard: Restrict non-super-admins from changing roles or office assignments
    if (caller.role !== 'super_admin') {
      delete filtered.role;
      delete filtered.office;
      delete filtered.officeIds;
      delete filtered.status;
    }

    const batch = adminDb.batch();
    batch.update(adminDb.collection('employees').doc(employeeId), {
      ...filtered,
      updatedAt: new Date().toISOString()
    });

    if (current.authUid) {
      const userUpdates: any = { 
        updatedAt: new Date().toISOString(), 
        ...filtered 
      };
      if (filtered.fullName) userUpdates.displayName = filtered.fullName;
      
      batch.update(adminDb.collection('users').doc(current.authUid), userUpdates);

      if (filtered.email && filtered.email !== current.email) {
        await adminAuth.updateUser(current.authUid, { email: filtered.email });
      }
      if (filtered.status) {
        await adminAuth.updateUser(current.authUid, { disabled: filtered.status === 'Suspended' });
      }
    }

    await batch.commit();
    await logAuditServer(caller.uid, 'ADMIN_UPDATE_IDENTITY', employeeId, { updatedFields: Object.keys(filtered) });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * provisionIdentityAction
 */
export async function provisionIdentityAction(idToken: string, formData: any, password: string) {
  const caller = await getAuthorizedCaller(idToken, formData.office);
  await assertOfficeActive(formData.office);

  const employeeId = formData.employeeId.toUpperCase().trim();
  const email = formData.email.toLowerCase().trim();
  const phoneFormatted = `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`;
  const roleNormalized = (formData.role || 'user').toLowerCase();

  try {
    const [idSnap, emailSnap, phoneSnap] = await Promise.all([
      adminDb.collection('employees').doc(employeeId).get(),
      adminDb.collection('employees').where('email', '==', email).get(),
      adminDb.collection('employees').where('whatsappNumber', '==', phoneFormatted).get()
    ]);

    if (idSnap.exists) throw new Error("Identity Lock: Employee ID already registered.");
    if (!emailSnap.empty) throw new Error("Identity Lock: Email already bound.");
    if (!phoneSnap.empty) throw new Error("Identity Lock: Mobile already bound.");

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
      role: roleNormalized,
      office: formData.office,
      officeIds: formData.officeIds || (roleNormalized === 'admin' ? [formData.office] : []),
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
      lastLogin: null
    });

    await batch.commit();
    await logAuditServer(caller.uid, 'ADMIN_PROVISION_IDENTITY', employeeId, { office: formData.office, role: roleNormalized });

    return { success: true, uid: authUser.uid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * syncProfileOnLoginAction
 */
export async function syncProfileOnLoginAction(idToken: string) {
  if (!idToken) throw new Error("Token missing.");
  
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const user = await adminAuth.getUser(decoded.uid);
    
    const field = user.phoneNumber ? 'whatsappNumber' : 'email';
    const value = user.phoneNumber || user.email;
    
    if (!value) throw new Error("No identifying field found in auth token.");

    const empSnap = await adminDb.collection('employees').where(field, '==', value).get();
    
    if (empSnap.empty) {
      throw new Error("This identity is not authorized for portal access.");
    }

    const employee = empSnap.docs[0].data();
    
    if (employee.status !== 'Active') {
      throw new Error(`Account Status: ${employee.status.toUpperCase()}. Access restricted.`);
    }

    const batch = adminDb.batch();
    const empRef = adminDb.collection('employees').doc(employee.id);
    const userRef = adminDb.collection('users').doc(user.uid);

    batch.update(empRef, { authUid: user.uid, updatedAt: new Date().toISOString() });

    batch.set(userRef, {
      uid: user.uid,
      email: employee.email || user.email || null,
      role: employee.role,
      displayName: employee.fullName,
      employeeId: employee.id,
      phoneNumber: user.phoneNumber || employee.whatsappNumber,
      office: employee.office || null,
      officeIds: employee.officeIds || (employee.office ? [employee.office] : []),
      status: 'Active',
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();
    
    return { success: true, role: employee.role, fullName: employee.fullName, employeeId: employee.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updateAccountStatusAction(idToken: string, employeeId: string, newStatus: string) {
  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const empData = empSnap.data()!;

    const caller = await getAuthorizedCaller(idToken, empData.office);

    if (empData.role?.toLowerCase() === 'super_admin' && caller.role !== 'super_admin') {
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
