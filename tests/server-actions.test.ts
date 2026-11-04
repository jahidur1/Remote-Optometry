import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionIdentityAction, updateAccountStatusAction, updateEmployeeRecordAction } from '@/services/identity-actions';
import { generateWeeklyRoster } from '@/ai/flows/generate-weekly-roster';
import { saveQuotaAction } from '@/services/quota-actions';
import { createOfficeAction } from '@/services/office-actions';

// Define stable mocks to ensure consistency during multi-step server actions
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();

const mockDoc = vi.fn(() => ({
  get: mockGet,
  update: mockUpdate,
  set: mockSet,
}));

const mockWhereGet = vi.fn();
const mockCollection = vi.fn(() => ({
  doc: mockDoc,
  add: vi.fn(),
  where: vi.fn(() => ({
    get: mockWhereGet,
    orderBy: vi.fn(() => ({ get: mockWhereGet }))
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
    runTransaction: vi.fn(async (fn) => fn({
       get: mockGet,
       set: mockBatchSet,
       update: mockBatchUpdate
    })),
  },
}));

// Mock external services
vi.mock('@/lib/solver-client', () => ({
  callSolver: vi.fn().mockResolvedValue({ 
    status: 'OPTIMAL', 
    assignments: [], 
    metadata: { solveTimeMs: 100 },
    errors: []
  })
}));

vi.mock('@/lib/integrity-checker', () => ({
  verifyRosterIntegrity: vi.fn().mockReturnValue({ isValid: true, issues: [] })
}));

describe('ROC Workforce: Core Roster Management - Resilience & Security', () => {
  const mockIdToken = 'valid_token';

  beforeEach(() => {
    vi.clearAllMocks();
    (require('@/lib/firebase-admin').adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'admin_uid' });
    // Default profile mock
    mockGet.mockImplementation((ref) => {
       if (ref?.path?.includes('users/admin_uid')) {
          return { exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) };
       }
       if (ref?.path?.includes('offices/KOLKATA_ROC')) {
          return { exists: true, data: () => ({ officeId: 'KOLKATA_ROC', status: 'Active' }) };
       }
       return { exists: false };
    });
    mockWhereGet.mockResolvedValue({ empty: true, docs: [] });
  });

  // --- 1. OFFICE REGISTRY TESTS ---

  it('createOfficeAction: Successfully provisions new cluster', async () => {
    mockGet.mockResolvedValueOnce({ exists: false }); // Office Not Found
    mockGet.mockResolvedValueOnce({ exists: false }); // Short Code Not Found
    
    const result = await createOfficeAction(mockIdToken, {
      officeId: 'NEW_ROC',
      officeName: 'New Cluster',
      shortCode: 'NEW'
    });
    expect(result.success).toBe(true);
  });

  // --- 2. IDENTITY DUPLICATE CHECKS ---

  it('provisionIdentityAction: Rejects duplicate phone numbers', async () => {
    mockGet.mockImplementation((ref) => {
       if (ref?.path?.includes('users/admin_uid')) return { exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) };
       if (ref?.path?.includes('offices/KOLKATA_ROC')) return { exists: true, data: () => ({ status: 'Active' }) };
       return { exists: false };
    });

    // Mock phone number exists
    mockWhereGet.mockResolvedValueOnce({ empty: true }); // email search
    mockWhereGet.mockResolvedValueOnce({ empty: false }); // phone search

    const result = await provisionIdentityAction(mockIdToken, { 
      office: 'KOLKATA_ROC', 
      employeeId: 'E1', 
      fullName: 'John',
      email: 'john@roc.test',
      whatsappNumber: '9999900000'
    }, 'pass1234');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Mobile endpoint already bound');
  });

  // --- 3. ROSTER SOLVER SCOPING ---

  it('generateWeeklyRoster: Rejects unauthorized office request for Admin', async () => {
    mockGet.mockImplementation((ref) => {
       if (ref?.path?.includes('users/admin_uid')) return { exists: true, data: () => ({ 
         role: 'ADMIN', 
         status: 'Active', 
         officeIds: ['GURGAON_ROC'] 
       }) };
       if (ref?.path?.includes('offices/KOLKATA_ROC')) return { exists: true, data: () => ({ status: 'Active' }) };
       return { exists: false };
    });

    await expect(generateWeeklyRoster({ weekId: '2024-52', officeId: 'KOLKATA_ROC', idToken: mockIdToken }))
      .rejects.toThrow('not authorized');
  });

  it('generateWeeklyRoster: Fails when office-specific quota is missing', async () => {
    mockGet.mockImplementation((ref) => {
       if (ref?.path?.includes('users/admin_uid')) return { exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) };
       if (ref?.path?.includes('offices/KOLKATA_ROC')) return { exists: true, data: () => ({ status: 'Active' }) };
       // Quota Doc Not Found
       if (ref?.path?.includes('roster_quotas')) return { exists: false };
       return { exists: true, data: () => ({}) };
    });

    const result = await generateWeeklyRoster({ weekId: '2024-52', officeId: 'KOLKATA_ROC', idToken: mockIdToken });
    expect(result.status).toBe('UNKNOWN');
    expect(result.summary).toContain('quotas for ROC KOLKATA_ROC in Week 2024-52 have not been defined');
  });

  // --- 4. QUOTA ACTIONS TESTS ---

  it('saveQuotaAction: Admin can save authorized office quota', async () => {
    mockGet.mockImplementation((ref) => {
       if (ref?.path?.includes('users/admin_uid')) return { exists: true, data: () => ({ role: 'ADMIN', status: 'Active', officeIds: ['KOLKATA_ROC'] }) };
       if (ref?.path?.includes('offices/KOLKATA_ROC')) return { exists: true, data: () => ({ status: 'Active' }) };
       return { exists: false };
    });
    
    const result = await saveQuotaAction(mockIdToken, {
      weekId: '2025-01',
      officeId: 'KOLKATA_ROC',
      quotas: { 'Monday_SO': 5 }
    });
    expect(result.success).toBe(true);
  });
});
