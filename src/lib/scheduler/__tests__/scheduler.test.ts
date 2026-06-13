import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockCronSchedule = vi.fn();
const mockCronStop = vi.fn();

vi.mock('node-cron', () => ({
  default: {
    schedule: mockCronSchedule.mockImplementation(() => ({
      stop: mockCronStop,
    })),
  },
}));

// Prisma mock for findActiveCampaign and account
const mockCampaignFindFirst = vi.fn();
const mockAccountFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mockCampaignFindFirst },
    whatsAppAccount: { findUnique: mockAccountFindUnique },
  },
}));

// ClientManager mock
const mockIsReady = vi.fn();
const mockGetClient = vi.fn();
const MockClientManager = vi.fn(function (this: any) {
  this.isReady = mockIsReady;
  this.getClient = mockGetClient;
  return this;
});

vi.mock('../../lib/whatsapp/client-manager', () => ({
  ClientManager: MockClientManager,
  waEvents: { emit: vi.fn(), on: vi.fn() },
}));

// Warmup mock
const mockHasReachedDailyLimit = vi.fn();

vi.mock('../warmup', () => ({
  hasReachedDailyLimit: mockHasReachedDailyLimit,
}));

// ProcessContact mock
vi.mock('../processContact', () => ({
  processNextContact: vi.fn(),
  checkCompletion: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────
let startScheduler: (accountId: string, clientManager: ReturnType<typeof MockClientManager>) => void;
let stopScheduler: (accountId: string) => void;
let findActiveCampaign: (accountId: string) => Promise<unknown>;

const NOW = new Date('2026-06-13T12:00:00Z');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules(); // Reset module-level cronTasks Map
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  const mod = await import('../index');
  startScheduler = mod.startScheduler;
  stopScheduler = mod.stopScheduler;
  findActiveCampaign = mod.findActiveCampaign;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────
describe('T07 — startScheduler(accountId)', () => {
  it('creates a cron job with * * * * * schedule', () => {
    const clientManager = new MockClientManager() as any;

    startScheduler('wa-1', clientManager);

    expect(mockCronSchedule).toHaveBeenCalledWith(
      '* * * * *',
      expect.any(Function),
    );
  });

  it('can start schedulers for multiple accounts independently', () => {
    const cm1 = new MockClientManager() as any;
    const cm2 = new MockClientManager() as any;

    startScheduler('wa-1', cm1);
    startScheduler('wa-2', cm2);

    // Two cron jobs created
    expect(mockCronSchedule).toHaveBeenCalledTimes(2);
  });

  it('skips tick when client is not ready', async () => {
    const clientManager = new MockClientManager() as any;
    mockIsReady.mockReturnValue(false);

    startScheduler('wa-1', clientManager);

    // Get the cron callback and execute it
    const cronCallback = getCronCallback();
    await cronCallback();

    // Should NOT call processNextContact or findActiveCampaign
    const { processNextContact } = await import('../processContact');
    expect(processNextContact).not.toHaveBeenCalled();
    expect(mockCampaignFindFirst).not.toHaveBeenCalled();
  });

  it('proceeds when client is ready and window/limits pass', async () => {
    const clientManager = new MockClientManager() as any;
    mockIsReady.mockReturnValue(true);
    mockGetClient.mockReturnValue({ sendMessage: vi.fn() });

    // Mock account with window that covers current time (12:00)
    mockAccountFindUnique.mockResolvedValue({
      id: 'wa-1',
      sendWindowStart: 9,
      sendWindowStartMin: 0,
      sendWindowEnd: 19,
      sendWindowEndMin: 0,
    });

    // Mock limit not reached
    mockHasReachedDailyLimit.mockResolvedValue(false);

    // Mock findActiveCampaign
    mockCampaignFindFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Test Campaign',
      delayMinSec: 30,
      delayMaxSec: 45,
    });

    startScheduler('wa-1', clientManager);

    const cronCallback = getCronCallback();
    await cronCallback();

    // Should call findActiveCampaign for this account
    expect(mockCampaignFindFirst).toHaveBeenCalledWith({
      where: {
        whatsappAccountId: 'wa-1',
        status: 'ACTIVE',
      },
      orderBy: { order: 'asc' },
    });

    // Should call processNextContact with client
    const { processNextContact } = await import('../processContact');
    expect(processNextContact).toHaveBeenCalled();
  });
});

describe('T07 — stopScheduler(accountId)', () => {
  it('stops the cron job for the given account', () => {
    const clientManager = new MockClientManager() as any;

    startScheduler('wa-1', clientManager);

    // One cron job was created
    expect(mockCronSchedule).toHaveBeenCalledTimes(1);

    stopScheduler('wa-1');

    // The cron's stop method was called
    expect(mockCronStop).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for unknown account', () => {
    stopScheduler('nonexistent');
    // No error thrown, no stop called
    expect(mockCronStop).not.toHaveBeenCalled();
  });
});

describe('T07 — findActiveCampaign', () => {
  it('finds first ACTIVE campaign for account ordered by order', async () => {
    mockCampaignFindFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Dental',
      order: 1,
    });

    const campaign = await findActiveCampaign('wa-1');

    expect(campaign).toEqual({ id: 'camp-1', name: 'Dental', order: 1 });
    expect(mockCampaignFindFirst).toHaveBeenCalledWith({
      where: { whatsappAccountId: 'wa-1', status: 'ACTIVE' },
      orderBy: { order: 'asc' },
    });
  });

  it('returns null when no active campaigns found', async () => {
    mockCampaignFindFirst.mockResolvedValue(null);

    const campaign = await findActiveCampaign('wa-empty');

    expect(campaign).toBe(null);
  });
});

// ── Helper ─────────────────────────────────────────
function getCronCallback(): () => Promise<void> {
  // The cron schedule mock was called; extract the callback
  for (const call of mockCronSchedule.mock.calls) {
    if (call[0] === '* * * * *') {
      return call[1] as () => Promise<void>;
    }
  }
  throw new Error('No cron schedule found');
}
