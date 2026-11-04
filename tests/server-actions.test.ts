import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionIdentityAction, updateAccountStatusAction } from '@/services/identity-actions';

// Define stable mocks to ensure consistency during multi-step server actions
const mockGet = vi.fn();
const mockUpdate = vi.fn();
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
  },
  adminDb: {
    collection: mockCollection,
    batch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(),
    })),
  },
}));

describe('ROC Workforce: Trusted Server Actions', () => {
  const mockIdToken = 'valid_token';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisionIdentityAction: Rejects unauthorized caller role', async () => {
    const { adminAuth } = await import('@/lib/firebase-admin');
    
    // Simulate employee caller
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller_uid' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'EMPLOYEE', status: 'Active' })
    });

    await expect(provisionIdentityAction(mockIdToken, {}, 'password')).rejects.toThrow('Unauthorized: Administrative pulse required.');
  });

  it('provisionIdentityAction: Enforces office scoping for ordinary Admins', async () => {
    const { adminAuth } = await import('@/lib/firebase-admin');
    
    // 1. Handshake: Caller is Admin from Gurgaon
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller_uid' });
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'ADMIN', status: 'Active', office: 'GURGAON_ROC' })
    });

    // Attempting to provision for Kolkata
    const formData = { office: 'KOLKATA_ROC', employeeId: 'EMP_101', email: 'test@roc.internal' };
    
    await expect(provisionIdentityAction(mockIdToken, formData, 'password')).rejects.toThrow('Unauthorized: You cannot provision staff for cluster KOLKATA_ROC');
  });

  it('updateAccountStatusAction: Prevents ordinary Admin from modifying Super Admin', async () => {
    const { adminAuth } = await import('@/lib/firebase-admin');
    
    // 1. Handshake: Authenticate caller as ordinary Admin
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'caller_uid' });
    
    // Configure sequential database reads:
    // First call: getAuthorizedCaller fetching the caller profile
    // Second call: target employee record check in updateAccountStatusAction
    mockGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active' }) }) 
      .mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });

    await expect(updateAccountStatusAction(mockIdToken, 'target_id', 'Suspended')).rejects.toThrow('Privilege Block');
  });
});
