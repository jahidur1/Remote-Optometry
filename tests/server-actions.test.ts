import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionIdentityAction, updateAccountStatusAction, updateEmployeeRecordAction } from '@/services/identity-actions';
import { generateWeeklyRoster } from '@/ai/flows/generate-weekly-roster';
import { saveQuotaAction } from '@/services/quota-actions';

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
  },
}));

// Mock external services
vi.mock('@/lib/solver-client', () => ({
  callSolver: vi.fn().mockResolvedValue({ status: 'OPTIMAL', assignments: [], metadata: { solveTimeMs: 100 } })
}));

vi.mock('@/lib/integrity-checker', () => ({
  verifyRosterIntegrity: vi.fn().mockReturnValue({ isValid: true, issues: [] })
}));

describe('ROC Workforce: Trusted Server Actions - Resilience & Security', () => {
  const mockIdToken = 'valid_token';

  beforeEach(() => {
    vi.clearAllMocks();
    (require('@/lib/firebase-admin').adminAuth.verifyIdToken as any).mockResolvedValue({ uid: 'admin_uid' });
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'ADMIN', status: 'Active', office: 'KOLKATA_ROC', officeIds: ['KOLKATA_ROC'] })
    });
  });

  // --- 1. AUTHENTICATION & TOKEN SCENARIOS ---

  it('Authentication: Rejects missing ID tokens', async () => {
    await expect(provisionIdentityAction('', {}, 'password')).rejects.toThrow();
  });

  // --- 2. AUTHORIZATION REGRESSIONS ---

  it('Authorization: Ordinary Admin cannot modify Super Admin', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active' }) });
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });

    const result = await updateAccountStatusAction(mockIdToken, 'target_sa', 'Suspended');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Privilege Block');
  });

  // --- 3. ROSTER GENERATION TESTS ---

  it('generateWeeklyRoster: Enforces office scoping for ordinary Admins', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active', officeIds: ['GURGAON_ROC'] }) });
    const result = await generateWeeklyRoster({ weekId: '2024-52', officeId: 'KOLKATA_ROC', idToken: mockIdToken });
    expect(result.status).toBe('UNKNOWN');
    expect(result.summary).toContain('not authorized to manage rosters for cluster KOLKATA_ROC');
  });

  it('generateWeeklyRoster: Fails when office-specific quota is missing', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });
    mockWhereGet.mockResolvedValue({ docs: [] }); // Employees
    mockWhereGet.mockResolvedValueOnce({ docs: [] }); // Shifts
    mockGet.mockResolvedValueOnce({ exists: false }); // Quota Snap
    
    const result = await generateWeeklyRoster({ weekId: '2024-52', officeId: 'KOLKATA_ROC', idToken: mockIdToken });
    expect(result.status).toBe('UNKNOWN');
    expect(result.summary).toContain('Configuration Missing');
    expect(result.issuesEncountered[0]).toContain('MISSING_QUOTA_CONFIG');
  });

  // --- 4. QUOTA ACTIONS TESTS ---

  it('saveQuotaAction: Admin can save authorized office quota', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active', officeIds: ['KOLKATA_ROC'] }) });
    mockSet.mockResolvedValueOnce({});
    
    const result = await saveQuotaAction(mockIdToken, {
      weekId: '2025-01',
      officeId: 'KOLKATA_ROC',
      quotas: { 'Monday_SO': 5 }
    });
    expect(result.success).toBe(true);
  });

  it('saveQuotaAction: Admin denied unauthorized office quota', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'ADMIN', status: 'Active', officeIds: ['KOLKATA_ROC'] }) });
    
    await expect(saveQuotaAction(mockIdToken, {
      weekId: '2025-01',
      officeId: 'GURGAON_ROC',
      quotas: {}
    })).rejects.toThrow('Access Denied');
  });

  it('saveQuotaAction: Super Admin can save any office quota', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'SUPER_ADMIN', status: 'Active' }) });
    mockSet.mockResolvedValueOnce({});
    
    const result = await saveQuotaAction(mockIdToken, {
      weekId: '2025-01',
      officeId: 'LUCKNOW_ROC',
      quotas: {}
    });
    expect(result.success).toBe(true);
  });
});