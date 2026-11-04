'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logAuditServer } from './audit-service';

/**
 * Verifies the caller's identity and administrative role on the server.
 * USES checkRevocation=true for high-security administrative pulses.
 */
async function getAuthorizedCaller(idToken: string) {
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) return null;
    const profile = userSnap.data();
    
    if (profile?.status !== 'Active' || !['ADMIN', 'SUPER_ADMIN'].includes(profile?.role)) {
      return null;
    }
    
    return { uid: decoded.uid, ...profile };
  } catch (e) {
    console.error('Handshake Failure:', e);
    return null;
  }
}

/**
 * A. provisionIdentityAction
 * Orchestrates secure identity enrollment across Auth, Registry, and Profiles.
 */
export async function provisionIdentityAction(idToken: string, formData: any, password: string) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized: Administrative pulse required.");

  // 1. Office Isolation Check
  if (caller.role === 'ADMIN' && caller.office !== formData.office) {
    throw new Error(`Unauthorized: You cannot provision staff for cluster ${formData.office}.`);
  }

  const employeeId = formData.employeeId.toUpperCase();
  const email = formData.email.toLowerCase();
  const phoneFormatted = `+91${formData.whatsappNumber.replace(/\D/g, '').slice(-10)}`;

  try {
    // 2. Duplicate Detection
    const [idSnap, emailSnap] = await Promise.all([
      adminDb.collection('employees').doc(employeeId).get(),
      adminDb.collection('employees').where('email', '==', email).get()
    ]);

    if (idSnap.exists) throw new Error("Identity Lock: Employee ID already registered.");
    if (!emailSnap.empty) throw new Error("Identity Lock: Email already bound to a record.");

    // 3. Atomic Provisioning Node
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
    
    // Master Registry
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

    // Auth Profile
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
    console.error('Provisioning Pipeline Failure:', e);
    return { success: false, error: e.message };
  }
}

/**
 * B. updateAccountStatusAction
 * Implements centralized status management with hierarchical protection.
 */
export async function updateAccountStatusAction(idToken: string, employeeId: string, newStatus: string) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const empData = empSnap.data()!;

    // Super Admin Protection
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

    // Secondary Perimeter: Sync Firebase Auth status
    // Failure here is logged but not thrown, as Firestore status blocks the app.
    if (empData.authUid) {
      try {
        await adminAuth.updateUser(empData.authUid, { disabled: newStatus === 'Suspended' });
      } catch (authErr) {
        console.warn('Auth status sync failure (Traceable):', authErr);
      }
    }

    await logAuditServer(caller.uid, `ADMIN_${newStatus.toUpperCase()}_IDENTITY`, employeeId);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * C. updateEmployeeRecordAction
 * Enforces strict metadata allowlists and synchronizes Auth credentials.
 */
export async function updateEmployeeRecordAction(idToken: string, employeeId: string, updates: any) {
  const caller = await getAuthorizedCaller(idToken);
  if (!caller) throw new Error("Unauthorized.");

  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const current = empSnap.data()!;

    // Metadata Allowlist
    const allowed = ['fullName', 'whatsappNumber', 'department', 'designation', 'age', 'gender'];
    const filtered: any = {};
    
    allowed.forEach(key => {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    });

    // Privileged Fields (Super Admin Only)
    if (caller.role === 'SUPER_ADMIN') {
      if (updates.role) filtered.role = updates.role;
      if (updates.office) filtered.office = updates.office;
      if (updates.status) filtered.status = updates.status;
    }

    // Email Sync Node
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
      const userUpdates: any = { updatedAt: new Date().toISOString() };
      if (filtered.fullName) userUpdates.displayName = filtered.fullName;
      if (filtered.email) userUpdates.email = filtered.email;
      if (filtered.role) userUpdates.role = filtered.role;
      if (filtered.office) userUpdates.office = filtered.office;
      if (filtered.status) userUpdates.status = filtered.status;
      if (filtered.whatsappNumber) userUpdates.phoneNumber = filtered.whatsappNumber;

      batch.update(adminDb.collection('users').doc(current.authUid), userUpdates);
    }

    await batch.commit();
    await logAuditServer(caller.uid, 'ADMIN_UPDATE_IDENTITY', employeeId, { updatedFields: Object.keys(filtered) });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
