import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionIdentityAction, updateAccountStatusAction, updateEmployeeRecordAction } from '@/services/identity-actions';

// Define stable mocks to ensure consistency during multi-step server actions
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockBatchCommit = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();

const mockDoc = vi.fn(() => ({
  get: mockGet,
  update: mockUpdate,
}));

const mockWhereGet = vi.fn();
const mockCollection = vi.fn(() => ({
  doc: mockDoc,
  where: vi.fn(() => ({
    get: mockWhereGet,
  })),
}));

// Mocking Firebase Admin SDK with stable handlers
vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
  adminDb: {
    collection: mockCollection,
    batch: vi.fn(() => ({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })),
  },
}));

describe('ROC Workforce: Trusted Server Actions - Resilience & Security', () => {
  const mockIdToken = 'valid_token';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default success for getAuthorizedCaller
    (require('@/lib/firebase-admin').adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'admin_uid' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'ADMIN', status: 'Active', office: 'KOLKATA_ROC' })
    });
  });

  // --- 1. AUTHENTICATION & AUTHORIZATION REGRESSIONS ---

  it('Authentication: Rejects invalid ID tokens', async () => {
    (require('@/lib/firebase-admin').adminAuth.verifyIdToken as any).mockRejectedValue(new Error('Invalid token'));
    await expect(provisionIdentityAction('invalid', {}, 'password')).rejects.toThrow();
  });

  it('Authorization: Inactive Admin is denied administrative access', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'ADMIN', status: 'Suspended' })
    });
    await expect(updateAccountStatusAction(mockIdToken, 'target', 'Active')).rejects.toThrow('Unauthorized');
  });

  it('Authorization: Ordinary Admin cannot modify Super Admin', async () => {
    // 1st get: caller (Admin)
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active' }) });
    // 2nd get: target (Super Admin)
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });

    const result = await updateAccountStatusAction(mockIdToken, 'target_sa', 'Suspended');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Privilege Block');
  });

  // --- 2. PROVISIONING RECOVERY ---

  it('Provisioning: Handles orphaned Auth account on DB failure', async () => {
    const formData = { employeeId: 'EMP-NEW', email: 'new@roc.internal', office: 'KOLKATA_ROC', fullName: 'New User', whatsappNumber: '9999900000' };
    
    // Caller is Super Admin for full scope
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });
    // Duplicate check: record doesn't exist
    mockDoc().get.mockResolvedValueOnce({ exists: false }); 
    mockWhereGet.mockResolvedValueOnce({ empty: true });

    // Simulate Auth success
    (require('@/lib/firebase-admin').adminAuth.createUser as any).mockResolvedValue({ uid: 'new_uid' });
    // Simulate DB failure
    mockBatchCommit.mockRejectedValueOnce(new Error('Database Timeout'));

    const result = await provisionIdentityAction(mockIdToken, formData, 'password');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Database Timeout');
  });

  it('Provisioning: Idempotent retry after partial failure (Auth exists)', async () => {
    const formData = { employeeId: 'EMP-NEW', email: 'new@roc.internal', office: 'KOLKATA_ROC' };
    
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });
    mockDoc().get.mockResolvedValueOnce({ exists: false }); 
    mockWhereGet.mockResolvedValueOnce({ empty: true });

    // Simulate Firebase Auth reporting email already exists on retry
    (require('@/lib/firebase-admin').adminAuth.createUser as any).mockRejectedValueOnce({ 
      code: 'auth/email-already-use', 
      message: 'Email in use' 
    });

    const result = await provisionIdentityAction(mockIdToken, formData, 'password');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Email in use');
  });

  // --- 3. STATUS & RECORD RECOVERY ---

  it('Status Update: Reports partial failure if DB fails', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'EMPLOYEE', status: 'Active' }) });

    mockBatchCommit.mockRejectedValueOnce(new Error('Firestore Batch Error'));

    const result = await updateAccountStatusAction(mockIdToken, 'target_id', 'Suspended');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Firestore Batch Error');
  });

  it('Email Sync: Reports inconsistency if DB fails after Auth update', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'EMPLOYEE', email: 'old@roc.internal', authUid: 'target_uid' }) });

    // Simulate Auth success
    (require('@/lib/firebase-admin').adminAuth.updateUser as any).mockResolvedValue({});
    // Simulate DB failure
    mockBatchCommit.mockRejectedValueOnce(new Error('Atomic DB Commit Failed'));

    const result = await updateEmployeeRecordAction(mockIdToken, 'target_id', { email: 'new@roc.internal' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Atomic DB Commit Failed');
  });
});
