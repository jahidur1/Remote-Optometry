import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, query, limit } from 'firebase/firestore';
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
      // Provision an active Admin profile
      await setDoc(doc(db, 'users', 'admin_one'), { role: 'ADMIN', status: 'Active', office: 'KOLKATA_ROC', employeeId: 'EMP_ADM_1' });
      // Provision an active Employee profile
      await setDoc(doc(db, 'users', 'emp_one'), { role: 'EMPLOYEE', status: 'Active', office: 'KOLKATA_ROC', employeeId: 'EMP_1' });
      // Provision an inactive Admin profile
      await setDoc(doc(db, 'users', 'admin_inactive'), { role: 'ADMIN', status: 'Inactive', office: 'KOLKATA_ROC' });
      // Provision master registry
      await setDoc(doc(db, 'employees', 'EMP_1'), { id: 'EMP_1', fullName: 'John Doe', office: 'KOLKATA_ROC', age: 30 });
      await setDoc(doc(db, 'employees', 'EMP_2'), { id: 'EMP_2', fullName: 'Jane Smith', office: 'KOLKATA_ROC', age: 25 });
    });
  };

  it('Scenario 1: Unauthenticated user cannot read protected profiles', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await expect(getDoc(doc(unauthDb, 'users', 'admin_one'))).rejects.toThrow();
  });

  it('Scenario 2: Employee cannot modify user profiles (privilege escalation protection)', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(setDoc(doc(empDb, 'users', 'emp_one'), { role: 'ADMIN' }, { merge: true })).rejects.toThrow();
  });

  it('Scenario 3: Employee cannot list the entire directory (data leakage protection)', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(getDocs(collection(empDb, 'employees'))).rejects.toThrow();
  });

  it('Scenario 4: Employee can retrieve their own verified record', async () => {
    await setupData();
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    const snap = await getDoc(doc(empDb, 'employees', 'EMP_1'));
    expect(snap.exists()).toBe(true);
  });

  it('Scenario 5: Employee cannot retrieve another professional record', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(getDoc(doc(empDb, 'employees', 'EMP_2'))).rejects.toThrow();
  });

  it('Scenario 6: Employee can update their age (integer + range)', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(setDoc(doc(empDb, 'employees', 'EMP_1'), { age: 35 }, { merge: true })).resolves.not.toThrow();
  });

  it('Scenario 7: Invalid age values are rejected (type safety)', async () => {
    const empDb = testEnv.authenticatedContext('emp_one').firestore();
    await expect(setDoc(doc(empDb, 'employees', 'EMP_1'), { age: "thirty-five" }, { merge: true })).rejects.toThrow();
    await expect(setDoc(doc(empDb, 'employees', 'EMP_1'), { age: 12 }, { merge: true })).rejects.toThrow();
  });

  it('Scenario 10: Inactive Admin is denied administrative access', async () => {
    const inactiveAdminDb = testEnv.authenticatedContext('admin_inactive').firestore();
    await expect(getDocs(query(collection(inactiveAdminDb, 'employees')))).rejects.toThrow();
  });
});