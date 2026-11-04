import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionIdentityAction, updateAccountStatusAction } from '@/services/identity-actions';

// Mocking Firebase Admin SDK
vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
    createUser: vi.fn(),
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
      })),
      where: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
    batch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(),
    })),
  },
}));

describe('ROC Workforce: Trusted Server Actions', () => {
  const mockIdToken = 'valid_token';

  it('provisionIdentityAction: Rejects unauthorized caller role', async () => {
    const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
    
    // Simulate employee caller
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller_uid' });
    (adminDb.collection as any)().doc().get.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'EMPLOYEE', status: 'Active' })
    });

    await expect(provisionIdentityAction(mockIdToken, {}, 'password')).rejects.toThrow('Unauthorized');
  });

  it('provisionIdentityAction: Enforces office scoping for ordinary Admins', async () => {
    const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
    
    // Simulate Admin from Gurgaon trying to provision for Kolkata
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller_uid' });
    (adminDb.collection as any)().doc().get.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'ADMIN', status: 'Active', office: 'GURGAON_ROC' })
    });

    const formData = { office: 'KOLKATA_ROC', employeeId: 'EMP_101', email: 'test@roc.internal' };
    
    await expect(provisionIdentityAction(mockIdToken, formData, 'password')).rejects.toThrow('Unauthorized: You cannot provision staff for cluster KOLKATA_ROC');
  });

  it('updateAccountStatusAction: Prevents ordinary Admin from modifying Super Admin', async () => {
    const { adminAuth, adminDb } = await import('@/lib/firebase-admin');
    
    // Caller is Admin
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller_uid' });
    (adminDb.collection as any)().doc().get
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active' }) }) // Caller check
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) }); // Target check

    await expect(updateAccountStatusAction(mockIdToken, 'target_id', 'Suspended')).rejects.toThrow('Privilege Block');
  });
});