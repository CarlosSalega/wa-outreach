import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockCreateMany = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockDeleteMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreateContactList = vi.fn();
const mockFindUniqueAccount = vi.fn();
const mockContactFindMany = vi.fn();
const mockContactUpdate = vi.fn();
const mockQueueFindMany = vi.fn();

// Need a mock for prisma that supports all the models
const mockPrisma = {
  campaign: {
    findMany: mockFindMany,
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    deleteMany: vi.fn(),
  },
  contact: {
    findMany: mockContactFindMany,
    update: mockContactUpdate,
    updateMany: mockUpdateMany,
  },
  contactList: {
    create: mockCreateContactList,
  },
  messageQueue: {
    createMany: mockCreateMany,
    deleteMany: mockDeleteMany,
    findMany: mockQueueFindMany,
  },
  messageLog: {
    deleteMany: vi.fn(),
  },
  whatsAppAccount: {
    findUnique: mockFindUniqueAccount,
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
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
    url: string;
    private _body: string;
    constructor(_url: string, options?: { method?: string; body?: string }) {
      this.url = _url;
      this._body = options?.body ?? '';
    }
    async json() {
      return JSON.parse(this._body || '{}');
    }
    get nextUrl() {
      return new URL(this.url);
    }
  },
}));

vi.mock('@/lib/whatsapp/interpolate', () => ({
  interpolate: vi.fn((text: string) => text),
}));

function request(method: string, url: string, body?: unknown) {
  const NextReq = (vi.mocked(require('next/server').NextRequest));
  const req = new NextReq(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  (req as { json: () => Promise<unknown> }).json = async () => body ?? {};
  return req;
}

async function loadRoute() {
  return import('../app/api/campaigns/route');
}

const MOCK_CAMPAIGNS = [
  {
    id: 'c1',
    name: 'Dental Q1',
    status: 'ACTIVE',
    templateId: 't1',
    whatsappAccountId: 'wa-1',
    order: 0,
    delayMinSec: 45,
    delayMaxSec: 120,
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    template: { id: 't1', name: 'Greeting', messages: JSON.stringify([{ order: 1, body: 'Hi {{nombre}}' }]) },
    whatsappAccount: { id: 'wa-1', name: 'Dental' },
    contactList: null,
    _count: { queue: 5 },
  },
  {
    id: 'c2',
    name: 'Dental Q2',
    status: 'DONE',
    templateId: 't1',
    whatsappAccountId: 'wa-1',
    order: 1,
    delayMinSec: 30,
    delayMaxSec: 60,
    createdAt: new Date('2026-06-05'),
    updatedAt: new Date('2026-06-05'),
    template: { id: 't1', name: 'Greeting', messages: JSON.stringify([{ order: 1, body: 'Hi {{nombre}}' }]) },
    whatsappAccount: { id: 'wa-1', name: 'Dental' },
    contactList: null,
    _count: { queue: 0 },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  jsonMock.mockClear();
  // Reset all mocks
  mockFindMany.mockReset();
  mockFindFirst.mockReset();
  mockCreate.mockReset();
  mockCreateMany.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockDeleteMany.mockReset();
  mockUpdateMany.mockReset();
  mockCreateContactList.mockReset();
  mockFindUniqueAccount.mockReset();
  mockContactFindMany.mockReset();
  mockContactUpdate.mockReset();
  mockQueueFindMany.mockReset();
});

// ── T10 Tests: Campaigns API Update ─────────────────
describe('T10 — Campaigns API (multi-account)', () => {
  // ─── GET /api/campaigns ──────────────────────────
  describe('GET /api/campaigns', () => {
    it('returns all campaigns (not just first) expanded with account and contactList', async () => {
      mockFindMany.mockResolvedValue(MOCK_CAMPAIGNS);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/campaigns');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].whatsappAccount).toBeDefined();
      expect(data[0].whatsappAccount.name).toBe('Dental');
      expect(mockFindMany).toHaveBeenCalledWith({
        include: {
          template: true,
          whatsappAccount: true,
          contactList: true,
          _count: { select: { queue: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no campaigns exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/campaigns');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toEqual([]);
    });
  });

  // ─── POST /api/campaigns ─────────────────────────
  describe('POST /api/campaigns', () => {
    it('creates campaign with whatsappAccountId, contactListId, and order', async () => {
      const created = {
        id: 'c-new',
        name: 'Test Campaign',
        status: 'ACTIVE',
        templateId: 't1',
        whatsappAccountId: 'wa-1',
        order: 0,
      };
      mockCreate.mockResolvedValue({
        ...created,
        template: { id: 't1', name: 'Greeting', messages: JSON.stringify([{ order: 1, body: 'Hello' }]) },
      });
      mockContactFindMany.mockResolvedValue([]);

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/campaigns', {
        name: 'Test Campaign',
        templateId: 't1',
        whatsappAccountId: 'wa-1',
        contactListId: 'cl-1',
        order: 0,
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.campaign.name).toBe('Test Campaign');
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Campaign',
          templateId: 't1',
          whatsappAccountId: 'wa-1',
          order: 0,
        }),
        include: { template: true },
      });
    });

    it('creates campaign without contactListId (backward compatible)', async () => {
      mockCreate.mockResolvedValue({
        id: 'c-bc',
        name: 'Legacy Campaign',
        status: 'ACTIVE',
        templateId: 't1',
        template: { id: 't1', name: 'Greeting', messages: JSON.stringify([{ order: 1, body: 'Hello' }]) },
      });
      mockContactFindMany.mockResolvedValue([]);

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/campaigns', {
        name: 'Legacy Campaign',
        templateId: 't1',
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.campaign.name).toBe('Legacy Campaign');
      expect(data.campaign.whatsappAccountId).toBeUndefined();
    });

    it('returns 400 when required fields are missing', async () => {
      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/campaigns', {
        name: 'Bad Campaign',
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });
});
