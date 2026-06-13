import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { seedMultiAccount } from '../../prisma/seed';

// ── Mocks ──────────────────────────────────────────
const mockFindFirst = vi.fn();
const mockCreateAccount = vi.fn();
const mockCreateList = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindMany = vi.fn();

function createMockPrisma() {
  return {
    appConfig: {
      findFirst: mockFindFirst,
    },
    whatsAppAccount: {
      create: mockCreateAccount,
    },
    campaign: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
    contactList: {
      create: mockCreateList,
    },
    contact: {
      updateMany: mockUpdateMany,
    },
  } as unknown as PrismaClient;
}

describe('T03 — Seed: multi-account migration backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Creating default WhatsAppAccount from AppConfig', () => {
    it('creates account with default values when AppConfig is missing', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1', name: 'Default Account' });
      mockFindMany.mockResolvedValue([]);

      const result = await seedMultiAccount(createMockPrisma());

      expect(mockCreateAccount).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: expect.any(String),
          waAccountStartDate: expect.any(Date),
          dailyLimit: 50,
          sendWindowStart: 9,
          sendWindowStartMin: 0,
          sendWindowEnd: 19,
          sendWindowEndMin: 0,
          status: 'CONFIGURED',
        }),
      });
      expect(result.accountId).toBe('wa-1');
    });

    it('copies warmup fields from existing AppConfig', async () => {
      const existingConfig = {
        id: 'cfg-1',
        waAccountStartDate: new Date('2026-01-15'),
        dailyLimit: 80,
        sendWindowStart: 10,
        sendWindowStartMin: 30,
        sendWindowEnd: 18,
        sendWindowEndMin: 45,
      };
      mockFindFirst.mockResolvedValue(existingConfig);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1', name: 'From Config' });
      mockFindMany.mockResolvedValue([]);

      await seedMultiAccount(createMockPrisma());

      expect(mockCreateAccount).toHaveBeenCalledWith({
        data: expect.objectContaining({
          waAccountStartDate: existingConfig.waAccountStartDate,
          dailyLimit: 80,
          sendWindowStart: 10,
          sendWindowStartMin: 30,
          sendWindowEnd: 18,
          sendWindowEndMin: 45,
        }),
      });
    });
  });

  describe('Backfilling Campaign.whatsappAccountId', () => {
    it('updates all existing campaigns to reference the default account', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1' });
      mockFindMany.mockResolvedValue([
        { id: 'camp-1', name: 'Campaign 1' },
        { id: 'camp-2', name: 'Campaign 2' },
      ]);
      mockUpdate.mockResolvedValue({});
      mockCreateList.mockResolvedValue({ id: 'list-1', campaignId: 'camp-1' });
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await seedMultiAccount(createMockPrisma());

      expect(mockFindMany).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
        data: expect.objectContaining({
          whatsappAccountId: 'wa-1',
          order: 0,
        }),
      });
      expect(result.campaignsUpdated).toBe(2);
    });

    it('returns 0 campaignsUpdated when no campaigns exist', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1' });
      mockFindMany.mockResolvedValue([]);

      const result = await seedMultiAccount(createMockPrisma());

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result.campaignsUpdated).toBe(0);
    });
  });

  describe('Creating ContactList per campaign', () => {
    it('creates one ContactList per existing campaign', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1' });
      mockFindMany.mockResolvedValue([
        { id: 'camp-1', name: 'Dental Leads' },
        { id: 'camp-2', name: 'RE Followup' },
      ]);
      mockUpdate.mockResolvedValue({});
      mockCreateList.mockResolvedValue({ id: 'list-new', campaignId: 'camp-1' });
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await seedMultiAccount(createMockPrisma());

      expect(mockCreateList).toHaveBeenCalledTimes(2);
      expect(mockCreateList).toHaveBeenCalledWith({
        data: { name: 'Dental Leads', campaignId: 'camp-1' },
      });
      expect(mockCreateList).toHaveBeenCalledWith({
        data: { name: 'RE Followup', campaignId: 'camp-2' },
      });
      expect(result.listsCreated).toBe(2);
    });
  });

  describe('Backfilling Contact.contactListId', () => {
    it('links contacts to their campaign ContactList', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1' });
      mockFindMany.mockResolvedValue([{ id: 'camp-1', name: 'Camp 1' }]);
      mockUpdate.mockResolvedValue({});
      mockCreateList.mockResolvedValue({ id: 'list-camp-1', campaignId: 'camp-1' });
      mockUpdateMany.mockResolvedValue({ count: 3 });

      await seedMultiAccount(createMockPrisma());

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-1' },
        data: { contactListId: 'list-camp-1' },
      });
    });

    it('handles multiple campaigns with their own lists', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreateAccount.mockResolvedValue({ id: 'wa-1' });
      mockFindMany.mockResolvedValue([
        { id: 'camp-A', name: 'A' },
        { id: 'camp-B', name: 'B' },
      ]);
      mockUpdate.mockResolvedValue({});
      mockCreateList
        .mockResolvedValueOnce({ id: 'list-1', campaignId: 'camp-A' })
        .mockResolvedValueOnce({ id: 'list-2', campaignId: 'camp-B' });
      mockUpdateMany.mockResolvedValue({ count: 0 });

      await seedMultiAccount(createMockPrisma());

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-A' },
        data: { contactListId: 'list-1' },
      });
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-B' },
        data: { contactListId: 'list-2' },
      });
    });
  });

  describe('Result summary', () => {
    it('returns complete stats after seed', async () => {
      mockFindFirst.mockResolvedValue({
        waAccountStartDate: new Date(),
        dailyLimit: 50,
        sendWindowStart: 9,
        sendWindowStartMin: 0,
        sendWindowEnd: 19,
        sendWindowEndMin: 0,
      });
      mockCreateAccount.mockResolvedValue({ id: 'wa-default' });
      mockFindMany.mockResolvedValue([
        { id: 'camp-1', name: 'A' },
        { id: 'camp-2', name: 'B' },
        { id: 'camp-3', name: 'C' },
      ]);
      mockUpdate.mockResolvedValue({});
      mockCreateList.mockResolvedValue({ id: 'list-id', campaignId: 'camp-1' });
      mockUpdateMany.mockResolvedValue({ count: 5 });

      const result = await seedMultiAccount(createMockPrisma());

      expect(result).toEqual({
        accountId: 'wa-default',
        campaignsUpdated: 3,
        listsCreated: 3,
        contactsBackfilled: 15,
      });
    });
  });
});
