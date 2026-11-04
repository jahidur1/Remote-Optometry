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
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    
    if (!userSnap.exists) throw new Error("Unauthorized: Identity node not found.");
    const profile = userSnap.data()!;
    
    if (profile.status !== 'Active') throw new Error("Unauthorized: Account suspended.");
    if (!['admin', 'super_admin'].includes(profile.role)) throw new Error("Unauthorized: Elevated pulse required.");

    const authorizedOffices = profile.officeIds || (profile.office ? [profile.office] : []);

    if (requestedOfficeId && profile.role !== 'super_admin') {
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
 * selfRegisterAction
 * PUBLIC NODE: Allows new users to sign up with a default 'user' role.
 * Hardened for ROC 2026 Registry Protocols.
 */
export async function selfRegisterAction(formData: any, password: string) {
  const { fullName, email, employeeId, whatsappNumber, office } = formData;
  const normalizedEmployeeId = employeeId.toUpperCase().trim();
  const normalizedEmail = email.toLowerCase().trim();
  const phoneFormatted = `+91${whatsappNumber.replace(/\D/g, '').slice(-10)}`;

  try {
    // 1. Availability Pulse
    const [idSnap, emailSnap, phoneSnap] = await Promise.all([
      adminDb.collection('employees').doc(normalizedEmployeeId).get(),
      adminDb.collection('employees').where('email', '==', normalizedEmail).get(),
      adminDb.collection('employees').where('whatsappNumber', '==', phoneFormatted).get()
    ]);

    if (idSnap.exists) throw new Error("Registry Conflict: Employee ID already registered.");
    if (!emailSnap.empty) throw new Error("Registry Conflict: Email already bound to a node.");
    if (!phoneSnap.empty) throw new Error("Registry Conflict: Mobile number already bound.");

    // 2. Provision Auth Node
    const authUser = await adminAuth.createUser({
      email: normalizedEmail,
      password: password,
      displayName: fullName,
      phoneNumber: phoneFormatted,
      emailVerified: false
    });

    const commonData = {
      fullName,
      email: normalizedEmail,
      whatsappNumber: phoneFormatted,
      role: 'user', // Strictly enforced default
      office: office,
      status: 'Active',
      updatedAt: new Date().toISOString()
    };

    const batch = adminDb.batch();
    
    // 3. Mirror to Master Registry
    batch.set(adminDb.collection('employees').doc(normalizedEmployeeId), {
      ...commonData,
      id: normalizedEmployeeId,
      gender: 'Male', // Default, user can update in profile
      department: 'Remote Optometry',
      designation: 'Professional Staff',
      joinedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      authUid: authUser.uid
    });

    // 4. Mirror to Governance Profile
    batch.set(adminDb.collection('users').doc(authUser.uid), {
      ...commonData,
      uid: authUser.uid,
      displayName: fullName,
      employeeId: normalizedEmployeeId,
      phoneNumber: phoneFormatted,
      lastLogin: null
    });

    await batch.commit();
    await logAuditServer('system_self_reg', 'USER_SELF_REGISTRATION', normalizedEmployeeId, { office });

    return { success: true, uid: authUser.uid };
  } catch (e: any) {
    console.error('Self-Registration Failure:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * syncProfileOnLoginAction
 * Securely consolidates multiple auth methods to a single clinical professional record.
 */
export async function syncProfileOnLoginAction(idToken: string) {
  if (!idToken) throw new Error("Token missing.");
  
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const user = await adminAuth.getUser(decoded.uid);
    
    const field = user.phoneNumber ? 'whatsappNumber' : 'email';
    const value = user.phoneNumber || user.email;
    
    if (!value) throw new Error("No identifying field found in auth token.");

    const empSnap = await adminDb.collection('employees').where(field, '==', value).get();
    
    if (empSnap.empty) {
      throw new Error("This identity is not authorized for portal access. Contact administrative nodes.");
    }

    const employee = empSnap.docs[0].data();
    
    if (employee.status !== 'Active') {
      throw new Error(`Account Status: ${employee.status.toUpperCase()}. Access restricted.`);
    }

    const batch = adminDb.batch();
    const empRef = adminDb.collection('employees').doc(employee.id);
    const userRef = adminDb.collection('users').doc(user.uid);

    batch.update(empRef, {
      authUid: user.uid,
      updatedAt: new Date().toISOString()
    });

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
    
    return { 
      success: true, 
      role: employee.role, 
      fullName: employee.fullName,
      employeeId: employee.id 
    };
  } catch (e: any) {
    console.error('Login Pulse Failure:', e.message);
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
      role: formData.role,
      office: formData.office,
      officeIds: formData.role === 'admin' ? [formData.office] : [],
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
    await logAuditServer(caller.uid, 'ADMIN_PROVISION_IDENTITY', employeeId, { office: formData.office, role: formData.role });

    return { success: true, uid: authUser.uid };
  } catch (e: any) {
    console.error('Provisioning Pulse Failure:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * seedFirstSuperAdminAction
 * ONE-TIME INITIALIZATION: Creates the first Super Admin identity node.
 */
export async function seedFirstSuperAdminAction() {
  const email = 'jahidur1204@gmail.com';
  const fullName = 'JAHIDUR RAHAMAN';
  const phone = '+919832441153';
  const employeeId = 'ROC-SADMIN-001';
  const password = 'Initial@1234';

  try {
    const existingSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (existingSnap.exists) {
      return { success: false, error: "System already initialized. Identity exists." };
    }

    // 1. Create Auth User
    const authUser = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
      phoneNumber: phone,
      emailVerified: true
    });

    const commonData = {
      fullName,
      email,
      whatsappNumber: phone,
      role: 'super_admin',
      office: 'HQ_GLOBAL',
      officeIds: [],
      status: 'Active',
      updatedAt: new Date().toISOString()
    };

    const batch = adminDb.batch();
    
    batch.set(adminDb.collection('employees').doc(employeeId), {
      ...commonData,
      id: employeeId,
      gender: 'Male',
      department: 'Infrastructure',
      designation: 'System Architect',
      joinedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      authUid: authUser.uid
    });

    batch.set(adminDb.collection('users').doc(authUser.uid), {
      ...commonData,
      uid: authUser.uid,
      displayName: fullName,
      employeeId,
      phoneNumber: phone,
      lastLogin: null
    });

    await batch.commit();
    return { success: true, message: "System initialized successfully." };
  } catch (e: any) {
    console.error('Initialization failure:', e.message);
    return { success: false, error: e.message };
  }
}

export async function updateAccountStatusAction(idToken: string, employeeId: string, newStatus: string) {
  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const empData = empSnap.data()!;

    const caller = await getAuthorizedCaller(idToken, empData.office);

    if (empData.role === 'super_admin' && caller.role !== 'super_admin') {
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

export async function updateEmployeeRecordAction(idToken: string, employeeId: string, updates: any) {
  try {
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Record not found.");
    const current = empSnap.data()!;

    const caller = await getAuthorizedCaller(idToken, current.office);

    const allowed = ['fullName', 'whatsappNumber', 'department', 'designation', 'age', 'gender', 'office', 'officeIds', 'role'];
    const filtered: any = {};
    allowed.forEach(key => { if (updates[key] !== undefined) filtered[key] = updates[key]; });

    if (caller.role !== 'super_admin') {
      delete filtered.role;
      delete filtered.office;
      delete filtered.officeIds;
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
    }

    await batch.commit();
    await logAuditServer(caller.uid, 'ADMIN_UPDATE_IDENTITY', employeeId);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
