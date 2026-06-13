import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindUniqueAccount = vi.fn();
const mockMessageLogCount = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppAccount: { findUnique: mockFindUniqueAccount },
    messageLog: { count: mockMessageLogCount },
  },
}));

const NOW = new Date('2026-06-13T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

async function loadModule() {
  return import('../lib/scheduler/warmup');
}

// ── Tests: getDailyLimit(accountId) ────────────────
describe('T06 — getDailyLimit(accountId)', () => {
  it('returns 10 if account has 0-3 days since start', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(2),
      dailyLimit: 100,
    });

    const { getDailyLimit } = await loadModule();
    expect(await getDailyLimit('wa-A')).toBe(10);
    expect(mockFindUniqueAccount).toHaveBeenCalledWith({
      where: { id: 'wa-A' },
    });
  });

  it('returns 20 if account has 4-7 days', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(5),
      dailyLimit: 100,
    });

    const { getDailyLimit } = await loadModule();
    expect(await getDailyLimit('wa-B')).toBe(20);
  });

  it('returns 35 if account has 8-14 days', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(10),
      dailyLimit: 100,
    });

    const { getDailyLimit } = await loadModule();
    expect(await getDailyLimit('wa-C')).toBe(35);
  });

  it('returns account.dailyLimit after 14 days', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(20),
      dailyLimit: 80,
    });

    const { getDailyLimit } = await loadModule();
    expect(await getDailyLimit('wa-D')).toBe(80);
  });

  it('returns 10 when account is not found', async () => {
    mockFindUniqueAccount.mockResolvedValue(null);

    const { getDailyLimit } = await loadModule();
    expect(await getDailyLimit('wa-nonexistent')).toBe(10);
  });

  it('each account gets independent limit calculation', async () => {
    mockFindUniqueAccount
      .mockResolvedValueOnce({
        waAccountStartDate: daysAgo(2),
        dailyLimit: 100,
      })
      .mockResolvedValueOnce({
        waAccountStartDate: daysAgo(10),
        dailyLimit: 100,
      });

    const { getDailyLimit } = await loadModule();
    const a = await getDailyLimit('wa-new');
    const b = await getDailyLimit('wa-old');

    expect(a).toBe(10);
    expect(b).toBe(35);
  });
});

// ── Tests: getDailyCount(accountId) ────────────────
describe('T06 — getDailyCount(accountId)', () => {
  it('counts sent messages for a specific account today', async () => {
    mockMessageLogCount.mockResolvedValue(15);

    const { getDailyCount } = await loadModule();
    const count = await getDailyCount('wa-A');

    expect(count).toBe(15);

    // Verify query filters by account
    const callArgs = mockMessageLogCount.mock.calls[0][0];
    expect(callArgs.where.status).toBe('sent');
    expect(callArgs.where.sentAt.gte).toBeDefined();
    expect(callArgs.where.messageQueue.campaign.whatsappAccountId).toBe('wa-A');
  });

  it('returns 0 when no messages sent today for account', async () => {
    mockMessageLogCount.mockResolvedValue(0);

    const { getDailyCount } = await loadModule();
    expect(await getDailyCount('wa-empty')).toBe(0);
  });

  it('isolates counts between different accounts', async () => {
    mockMessageLogCount
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(3);

    const { getDailyCount } = await loadModule();
    const countA = await getDailyCount('wa-A');
    const countB = await getDailyCount('wa-B');

    expect(countA).toBe(25);
    expect(countB).toBe(3);

    // Second call used account 'wa-B'
    const secondArgs = mockMessageLogCount.mock.calls[1][0];
    expect(secondArgs.where.messageQueue.campaign.whatsappAccountId).toBe('wa-B');
  });
});

// ── Tests: hasReachedDailyLimit(accountId) ─────────
describe('T06 — hasReachedDailyLimit(accountId)', () => {
  it('returns true when count >= limit', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(30),
      dailyLimit: 50,
    });
    mockMessageLogCount.mockResolvedValue(50);

    const { hasReachedDailyLimit } = await loadModule();
    expect(await hasReachedDailyLimit('wa-A')).toBe(true);
  });

  it('returns false when count < limit', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(30),
      dailyLimit: 50,
    });
    mockMessageLogCount.mockResolvedValue(30);

    const { hasReachedDailyLimit } = await loadModule();
    expect(await hasReachedDailyLimit('wa-A')).toBe(false);
  });

  it('returns false for empty account', async () => {
    mockFindUniqueAccount.mockResolvedValue({
      waAccountStartDate: daysAgo(1),
      dailyLimit: 50,
    });
    mockMessageLogCount.mockResolvedValue(0);

    const { hasReachedDailyLimit } = await loadModule();
    expect(await hasReachedDailyLimit('wa-new')).toBe(false);
  });
});
