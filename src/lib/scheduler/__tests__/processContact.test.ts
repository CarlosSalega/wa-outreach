import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockCount = vi.fn();
const mockSendMessageSequence = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    messageQueue: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      count: mockCount,
    },
    messageLog: { create: mockCreate },
    campaign: { update: vi.fn() },
  },
}));

vi.mock('../../whatsapp/sender', () => ({
  sendMessageSequence: mockSendMessageSequence,
}));

// ── Helpers ────────────────────────────────────────
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    contactId: 'contact-1',
    campaignId: 'campaign-1',
    messageOrder: 1,
    bodySnapshot: 'Hola {{nombre}}',
    status: 'PENDING',
    scheduledAt: new Date('2026-06-06T10:00:00Z'),
    sentAt: null,
    errorMessage: null,
    attempts: 0,
    createdAt: new Date('2026-06-06T09:00:00Z'),
    updatedAt: new Date('2026-06-06T09:00:00Z'),
    contact: {
      id: 'contact-1',
      phone: '5491122334455',
      agencyName: 'Agency Test',
    },
    campaign: {
      id: 'campaign-1',
      delayMinSec: 30,
      delayMaxSec: 45,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────
describe('processNextContact', () => {
  it('no hace nada si no hay jobs pendientes', async () => {
    mockFindFirst.mockResolvedValue(null);

    const { processNextContact } = await import('../processContact');
    await processNextContact();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  describe('camino exitoso', () => {
    it('marca como SENT y crea MessageLog cuando el envío es exitoso', async () => {
      const job = makeJob();
      mockFindFirst.mockResolvedValue(job);
      mockSendMessageSequence.mockResolvedValue({
        success: true,
        messagesSent: 1,
      });

      const { processNextContact } = await import('../processContact');
      await processNextContact();

      // 1. Update a PROCESSING
      expect(mockUpdate).toHaveBeenNthCalledWith(1, {
        where: { id: job.id },
        data: { status: 'PROCESSING' },
      });

      // 2. Update a SENT con sentAt
      expect(mockUpdate).toHaveBeenNthCalledWith(2, {
        where: { id: job.id },
        data: {
          status: 'SENT',
          sentAt: expect.any(Date),
        },
      });

      // 3. MessageLog creado como sent
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          messageQueueId: job.id,
          status: 'sent',
          sentAt: expect.any(Date),
        },
      });
    });
  });

  describe('camino de fallo transitorio (attempts < 3)', () => {
    it('reprograma como PENDING sin crear MessageLog — el bug del P2002', async () => {
      const job = makeJob({ attempts: 0 });
      mockFindFirst.mockResolvedValue(job);
      mockSendMessageSequence.mockResolvedValue({
        success: false,
        messagesSent: 0,
        error: 'timeout',
      });

      const { processNextContact } = await import('../processContact');
      await processNextContact();

      // Update a PENDING + incrementa attempts + reschedule
      expect(mockUpdate).toHaveBeenNthCalledWith(2, {
        where: { id: job.id },
        data: {
          status: 'PENDING',
          attempts: 1,
          errorMessage: 'timeout',
          scheduledAt: expect.any(Date),
        },
      });

      // NO debe crear MessageLog en fallo transitorio
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('camino de fallo terminal (attempts >= 3)', () => {
    it('marca FAILED, crea MessageLog y ejecuta checkAndPause', async () => {
      const job = makeJob({ attempts: 2 });
      mockFindFirst.mockResolvedValue(job);
      mockSendMessageSequence.mockResolvedValue({
        success: false,
        messagesSent: 0,
        error: 'blocked',
      });
      // Que no pause la campaña (< 5 fallos en 1h)
      mockCount.mockResolvedValue(2);

      const { processNextContact } = await import('../processContact');
      await processNextContact();

      // Update a FAILED
      expect(mockUpdate).toHaveBeenNthCalledWith(2, {
        where: { id: job.id },
        data: {
          status: 'FAILED',
          attempts: 3,
          errorMessage: 'blocked',
          scheduledAt: job.scheduledAt,
        },
      });

      // MessageLog creado como failed
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          messageQueueId: job.id,
          status: 'failed',
          sentAt: expect.any(Date),
          errorCode: 'blocked',
        },
      });
    });
  });

  describe('auto-pausa por errores consecutivos', () => {
    it('pausa la campaña si hay 5+ fallos en la última hora', async () => {
      const job = makeJob({ attempts: 2 });

      mockFindFirst.mockResolvedValue(job);
      mockSendMessageSequence.mockResolvedValue({
        success: false,
        messagesSent: 0,
        error: 'connection_lost',
      });
      mockCount.mockResolvedValue(5);

      const { processNextContact } = await import('../processContact');
      await processNextContact();

      // Debe haber actualizado la campaña a PAUSED
      const { prisma } = await import('@/lib/prisma');
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: job.campaignId },
        data: {
          status: 'PAUSED',
          pauseReason: expect.any(String),
        },
      });
    });
  });
});
