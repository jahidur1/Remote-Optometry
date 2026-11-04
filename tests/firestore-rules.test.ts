import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, query, where, orderBy } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';

let testEnv: RulesTestEnvironment;

describe('ROC Workforce: Firestore Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'roc-workforce-security-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  const setupData = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Provision an active Super Admin
      await setDoc(doc(db, 'users', 'super_admin'), { role: 'SUPER_ADMIN', status: 'Active' });
      // Provision a multi-office Admin
      await setDoc(doc(db, 'users', 'multi_admin'), { role: 'ADMIN', status: 'Active', officeIds: ['KOLKATA_ROC', 'GURGAON_ROC'] });
      // Provision a legacy single-office Admin
      await setDoc(doc(db, 'users', 'legacy_admin'), { role: 'ADMIN', status: 'Active', office: 'KOLKATA_ROC' });
      // Provision an active Employee
      await setDoc(doc(db, 'users', 'emp_one'), { role: 'EMPLOYEE', status: 'Active', office: 'KOLKATA_ROC', employeeId: 'EMP_1' });
      // Provision master registry
      await setDoc(doc(db, 'employees', 'EMP_1'), { id: 'EMP_1', fullName: 'John Doe', office: 'KOLKATA_ROC', status: 'Active' });
      await setDoc(doc(db, 'employees', 'EMP_GUR'), { id: 'EMP_GUR', fullName: 'Jane GUR', office: 'GURGAON_ROC', status: 'Active' });
      await setDoc(doc(db, 'employees', 'EMP_LUC'), { id: 'EMP_LUC', fullName: 'Bob LUC', office: 'LUCKNOW_ROC', status: 'Active' });
    });
  };

  it('Scenario 1: Unauthenticated user cannot read protected profiles', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await expect(getDoc(doc(unauthDb, 'users', 'emp_one'))).rejects.toThrow();
  });

  it('Scenario 2: Employee cannot modify user profiles', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(setDoc(doc(empDb, 'users', 'emp_one'), { role: 'ADMIN' }, { merge: true })).rejects.toThrow();
  });

  it('Scenario 3: Employee cannot list the entire directory', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(getDocs(collection(empDb, 'employees'))).rejects.toThrow();
  });

  it('Scenario 4: Employee can retrieve their own verified record', async () => {
    await setupData();
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    const snap = await getDoc(doc(empDb, 'employees', 'EMP_1'));
    expect(snap.exists()).toBe(true);
  });

  it('Multi-Office Admin: Can access assigned offices (KOLKATA)', async () => {
    const adminDb = testEnv.authenticatedContext('multi_admin').firestore();
    const q = query(collection(adminDb, 'employees'), where('office', '==', 'KOLKATA_ROC'));
    await expect(getDocs(q)).resolves.not.toThrow();
  });

  it('Multi-Office Admin: Denied access to unassigned office (LUCKNOW)', async () => {
    const adminDb = testEnv.authenticatedContext('multi_admin').firestore();
    const q = query(collection(adminDb, 'employees'), where('office', '==', 'LUCKNOW_ROC'));
    await expect(getDocs(q)).rejects.toThrow();
  });

  it('Legacy Admin: Can access primary office via legacy string', async () => {
    const adminDb = testEnv.authenticatedContext('legacy_admin').firestore();
    const q = query(collection(adminDb, 'employees'), where('office', '==', 'KOLKATA_ROC'));
    await expect(getDocs(q)).resolves.not.toThrow();
  });

  it('Super Admin: Retains global access to all offices', async () => {
    const adminDb = testEnv.authenticatedContext('super_admin').firestore();
    await expect(getDocs(collection(adminDb, 'employees'))).resolves.not.toThrow();
  });

  it('Privilege: Client cannot modify their own officeIds array', async () => {
    const adminDb = testEnv.authenticatedContext('multi_admin').firestore();
    await expect(setDoc(doc(adminDb, 'users', 'multi_admin'), { officeIds: ['ALL'] }, { merge: true })).rejects.toThrow();
  });
});