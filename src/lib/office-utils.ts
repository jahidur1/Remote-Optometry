
import { adminDb } from './firebase-admin';

/**
 * Institutional Office Registry Helpers.
 * Used exclusively in server contexts to validate cluster nodes.
 */

export async function getOfficeById(officeId: string) {
  const snap = await adminDb.collection('offices').doc(officeId).get();
  return snap.exists ? snap.data() : null;
}

export async function assertOfficeExists(officeId: string) {
  const office = await getOfficeById(officeId);
  if (!office) {
    throw new Error(`Registry Alert: Cluster node ${officeId} not found.`);
  }
  return office;
}

export async function assertOfficeActive(officeId: string) {
  const office = await assertOfficeExists(officeId);
  if (office.status !== 'Active') {
    throw new Error(`Registry Alert: Cluster node ${officeId} is Inactive. Operational writes blocked.`);
  }
  return office;
}
