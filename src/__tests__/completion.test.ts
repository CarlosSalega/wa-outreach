import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockCount = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdateCampaign = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    messageQueue: {
      count: mockCount,
      updateMany: mockUpdateMany,
    },
    campaign: {
      update: mockUpdateCampaign,
    },
  },
}));

// ── Import after mocks ─────────────────────────────
async function loadModule() {
  return import('../lib/scheduler/processContact');
}

const NOW = new Date('2026-06-13T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests: checkCompletion ─────────────────────────
describe('T08 — checkCompletion(campaignId)', () => {
  it('sets campaign to DONE when PENDING count is 0', async () => {
    // No pending messages, no stuck processing
    mockCount.mockResolvedValue(0);

    const { checkCompletion } = await loadModule();
    await checkCompletion('campaign-1');

    // Campaign was marked DONE
    expect(mockUpdateCampaign).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { status: 'DONE' },
    });
  });

  it('does NOT mark DONE when PENDING count > 0', async () => {
    mockCount.mockResolvedValue(3);

    const { checkCompletion } = await loadModule();
    await checkCompletion('campaign-1');

    // Campaign was NOT updated
    expect(mockUpdateCampaign).not.toHaveBeenCalled();
    // No stuck PROCESSING reset either
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('resets stuck PROCESSING messages before re-checking completion', async () => {
    // First count: 0 pending (but there are stuck PROCESSING)
    mockCount
      .mockResolvedValueOnce(0);

    // updateMany should be called for stuck PROCESSING
    mockUpdateMany.mockResolvedValue({ count: 2 });

    // Second count after reset: still 0 pending
    mockCount.mockResolvedValueOnce(0);

    const { checkCompletion } = await loadModule();
    await checkCompletion('campaign-1');

    // Stuck messages were reset to PENDING
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        campaignId: 'campaign-1',
        status: 'PROCESSING',
        updatedAt: expect.any(Object),
      },
      data: {
        status: 'PENDING',
        scheduledAt: expect.any(Date),
        errorMessage: 'Reset by completion detection (stuck >10 min)',
      },
    });

    // After reset, campaign was marked DONE (still 0 pending)
    expect(mockUpdateCampaign).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: { status: 'DONE' },
    });
  });

  it('does NOT mark DONE when stuck reset creates new PENDING items', async () => {
    // First count: 0 pending
    mockCount.mockResolvedValueOnce(0);

    // Reset 2 stuck PROCESSING → PENDING
    mockUpdateMany.mockResolvedValue({ count: 2 });

    // Second count: 2 pending (from the reset)
    mockCount.mockResolvedValueOnce(2);

    const { checkCompletion } = await loadModule();
    await checkCompletion('campaign-1');

    // Stuck messages were reset
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);

    // But campaign NOT marked DONE because reset created pending items
    expect(mockUpdateCampaign).not.toHaveBeenCalled();
  });

  it('resets only PROCESSING messages older than 10 minutes', async () => {
    mockCount
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { checkCompletion } = await loadModule();
    await checkCompletion('campaign-1');

    // Verify the updatedAt filter is 10 minutes ago
    const updateArgs = mockUpdateMany.mock.calls[0][0];
    const tenMinutesAgo = new Date(NOW.getTime() - 10 * 60 * 1000);

    // The filter checks for updatedAt < 10 minutes ago
    expect(updateArgs.where.updatedAt.lt).toBeDefined();
    // Allow small time difference
    const filterTime = updateArgs.where.updatedAt.lt;
    expect(Math.abs(filterTime.getTime() - tenMinutesAgo.getTime())).toBeLessThan(1000);
  });
});
