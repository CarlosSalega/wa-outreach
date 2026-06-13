import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockLogCount = vi.fn();
const mockQueueCount = vi.fn();
const mockCampaignFindMany = vi.fn();
const mockAccountFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    messageLog: {
      count: mockLogCount,
    },
    messageQueue: {
      count: mockQueueCount,
    },
    campaign: {
      findMany: mockCampaignFindMany,
    },
    whatsAppAccount: {
      findMany: mockAccountFindMany,
    },
  },
}));

// ── Mock Next.js ───────────────────────────────────
const jsonMock = vi.fn((data: unknown, init?: ResponseInit) => {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => jsonMock(data, init),
  },
  NextRequest: class {
    private _url: string;
    constructor(url: string) {
      this._url = url;
    }
    get nextUrl() {
      return new URL(this._url);
    }
  },
}));

function request(url: string) {
  const NextReq = (vi.mocked(require('next/server').NextRequest));
  return new NextReq(url);
}

async function loadStatsRoute() {
  return import('../app/api/stats/route');
}

beforeEach(() => {
  vi.clearAllMocks();
  jsonMock.mockClear();
  mockLogCount.mockReset();
  mockQueueCount.mockReset();
  mockCampaignFindMany.mockReset();
  mockAccountFindMany.mockReset();
});

// ── T13 Tests: Stats API (per-account breakdown) ─────
describe('T13 — Stats API (per-account breakdown)', () => {
  describe('GET /api/stats', () => {
    it('returns per-account sent/failed/pending breakdown', async () => {
      const accounts = [
        { id: 'wa-1', name: 'Dental', status: 'CONNECTED' },
        { id: 'wa-2', name: 'Real Estate', status: 'CONFIGURED' },
      ];

      mockAccountFindMany.mockResolvedValue(accounts);
      mockCampaignFindMany.mockResolvedValue([
        { id: 'c1', name: 'Dental Q1', status: 'ACTIVE', whatsappAccountId: 'wa-1' },
        { id: 'c2', name: 'Dental Q2', status: 'DONE', whatsappAccountId: 'wa-1' },
        { id: 'c3', name: 'RE Q1', status: 'ACTIVE', whatsappAccountId: 'wa-2' },
      ]);

      // The implementation calls campaign.findMany again per account (inside Promise.all)
      // We need the same campaigns to be returned each time
      const account1Campaigns = [{ id: 'c1' }, { id: 'c2' }];
      const account2Campaigns = [{ id: 'c3' }];

      // campaign.findMany mock (used multiple times)
      let campaignFindManyCallCount = 0;
      mockCampaignFindMany.mockImplementation(() => {
        campaignFindManyCallCount++;
        // First call: full campaign list (in outer Promise.all)
        // Second call: wa-1 campaigns (inside byAccount map)
        // Third call: wa-2 campaigns (inside byAccount map)
        if (campaignFindManyCallCount === 1) {
          return Promise.resolve([
            { id: 'c1', name: 'Dental Q1', status: 'ACTIVE', whatsappAccountId: 'wa-1' },
            { id: 'c2', name: 'Dental Q2', status: 'DONE', whatsappAccountId: 'wa-1' },
            { id: 'c3', name: 'RE Q1', status: 'ACTIVE', whatsappAccountId: 'wa-2' },
          ]);
        }
        if (campaignFindManyCallCount === 2) {
          return Promise.resolve(account1Campaigns);
        }
        return Promise.resolve(account2Campaigns);
      });

      // messageLog.count and messageQueue.count mocks
      let logCountCall = 0;
      mockLogCount.mockImplementation(() => {
        logCountCall++;
        // Call 1: total sent today (Promise.all 1st)
        // Call 2: total failed today (Promise.all 2nd)
        // Call 3: wa-1 sent
        // Call 4: wa-1 failed
        // Call 5: wa-2 sent
        // Call 6: wa-2 failed
        switch (logCountCall) {
          case 1: return Promise.resolve(18); // total sent
          case 2: return Promise.resolve(5);  // total failed
          case 3: return Promise.resolve(15); // wa-1 sent
          case 4: return Promise.resolve(5);  // wa-1 failed
          case 5: return Promise.resolve(3);  // wa-2 sent
          case 6: return Promise.resolve(0);  // wa-2 failed
          default: return Promise.resolve(0);
        }
      });

      let queueCountCall = 0;
      mockQueueCount.mockImplementation(() => {
        queueCountCall++;
        // Call 1: total pending
        // Call 2: wa-1 pending
        // Call 3: wa-2 pending
        switch (queueCountCall) {
          case 1: return Promise.resolve(30);
          case 2: return Promise.resolve(10);
          case 3: return Promise.resolve(20);
          default: return Promise.resolve(0);
        }
      });

      const { GET } = await loadStatsRoute();
      const req = request('http://localhost:3000/api/stats');
      const res = await GET(req);

      const data = await res.json();

      // Backward compat: total counts
      expect(data.sentToday).toBe(18);
      expect(data.failedToday).toBe(5);
      expect(data.pendingTotal).toBe(30);

      // Campaign-level stats
      expect(data.campaigns).toHaveLength(3);

      // Per-account breakdown
      expect(data.byAccount).toBeDefined();
      expect(data.byAccount).toHaveLength(2);

      const dental = data.byAccount.find((a: { id: string }) => a.id === 'wa-1');
      const re = data.byAccount.find((a: { id: string }) => a.id === 'wa-2');

      expect(dental).toBeDefined();
      expect(dental.name).toBe('Dental');
      expect(dental.status).toBe('CONNECTED');
      expect(dental.campaigns).toBe(2);

      expect(re).toBeDefined();
      expect(re.name).toBe('Real Estate');
      expect(re.status).toBe('CONFIGURED');
      expect(re.campaigns).toBe(1);
    });

    it('handles empty accounts gracefully', async () => {
      mockAccountFindMany.mockResolvedValue([]);
      mockCampaignFindMany.mockResolvedValue([]);
      mockLogCount.mockResolvedValue(0);
      mockQueueCount.mockResolvedValue(0);

      const { GET } = await loadStatsRoute();
      const req = request('http://localhost:3000/api/stats');
      const res = await GET(req);

      const data = await res.json();
      expect(data.sentToday).toBe(0);
      expect(data.byAccount).toEqual([]);
      expect(data.campaigns).toEqual([]);
    });
  });
});
