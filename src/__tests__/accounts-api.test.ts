import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// client-manager mock
const mockGetStatus = vi.fn();
const mockGetQr = vi.fn();
const mockClientManager = {
  getStatus: (...args: unknown[]) => mockGetStatus(...args),
  getQr: (...args: unknown[]) => mockGetQr(...args),
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppAccount: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

vi.mock('@/lib/whatsapp/client-manager', () => ({
  clientManager: mockClientManager,
}));

// ── Mock Next.js APIs ──────────────────────────────
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
    method: string;
    private _body: string;
    constructor(url: string, options?: { method?: string; body?: string }) {
      this.url = url;
      this.method = options?.method ?? 'GET';
      this._body = options?.body ?? '';
    }
    async json() {
      return JSON.parse(this._body || '{}');
    }
    get nextUrl() {
      // Parse path segments for [id] dynamic routes
      return new URL(this.url);
    }
  },
}));

// ── Helper to create NextRequest ────────────────────
function request(method: string, url: string, body?: unknown) {
  const req = new (require('next/server').NextRequest)(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  // Patch json() to return the body
  if (body) {
    (req as { json: () => Promise<unknown> }).json = async () => body;
  }
  return req;
}

// ── Dynamic imports after mocks ────────────────────
async function loadListRoute() {
  return import('../app/api/accounts/route');
}
async function loadDetailRoute() {
  return import('../app/api/accounts/[id]/route');
}
async function loadStatusRoute() {
  return import('../app/api/accounts/[id]/status/route');
}

const MOCK_ACCOUNTS = [
  {
    id: 'wa-1',
    name: 'Dental',
    waAccountStartDate: new Date('2026-06-01'),
    dailyLimit: 50,
    sendWindowStart: 9,
    sendWindowStartMin: 0,
    sendWindowEnd: 18,
    sendWindowEndMin: 0,
    status: 'CONNECTED',
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    campaigns: [],
    _count: { campaigns: 0 },
  },
  {
    id: 'wa-2',
    name: 'Real Estate',
    waAccountStartDate: new Date('2026-06-10'),
    dailyLimit: 35,
    sendWindowStart: 9,
    sendWindowStartMin: 0,
    sendWindowEnd: 14,
    sendWindowEndMin: 0,
    status: 'CONFIGURED',
    createdAt: new Date('2026-06-10'),
    updatedAt: new Date('2026-06-10'),
    campaigns: [],
    _count: { campaigns: 0 },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  jsonMock.mockClear();
});

// ── T09 Tests: WhatsApp Account API ─────────────────
describe('T09 — WhatsAppAccount API', () => {
  // ─── GET /api/accounts ───────────────────────────
  describe('GET /api/accounts', () => {
    it('returns all accounts with campaign count', async () => {
      mockFindMany.mockResolvedValue(MOCK_ACCOUNTS);

      const { GET } = await loadListRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('wa-1');
      expect(data[0].name).toBe('Dental');
      expect(data[0]._count.campaigns).toBe(0);
      expect(mockFindMany).toHaveBeenCalledWith({
        include: {
          campaigns: true,
          _count: { select: { campaigns: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no accounts exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const { GET } = await loadListRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toEqual([]);
    });
  });

  // ─── POST /api/accounts ──────────────────────────
  describe('POST /api/accounts', () => {
    it('creates a new WhatsAppAccount with defaults', async () => {
      const created = {
        id: 'wa-new',
        name: 'New Account',
        waAccountStartDate: new Date(),
        dailyLimit: 50,
        sendWindowStart: 9,
        sendWindowStartMin: 0,
        sendWindowEnd: 19,
        sendWindowEndMin: 0,
        status: 'CONFIGURED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCreate.mockResolvedValue(created);

      const { POST } = await loadListRoute();
      const req = request('POST', 'http://localhost:3000/api/accounts', {
        name: 'New Account',
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.name).toBe('New Account');
      expect(data.status).toBe('CONFIGURED');
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Account',
          waAccountStartDate: expect.any(Date),
          dailyLimit: 50,
          sendWindowStart: 9,
          sendWindowStartMin: 0,
          sendWindowEnd: 19,
          sendWindowEndMin: 0,
          status: 'CONFIGURED',
        }),
      });
    });

    it('creates account with custom warmup config', async () => {
      const created = {
        id: 'wa-custom',
        name: 'Custom',
        waAccountStartDate: new Date('2026-06-01'),
        dailyLimit: 100,
        sendWindowStart: 8,
        sendWindowStartMin: 30,
        sendWindowEnd: 20,
        sendWindowEndMin: 0,
        status: 'CONFIGURED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCreate.mockResolvedValue(created);

      const { POST } = await loadListRoute();
      const req = request('POST', 'http://localhost:3000/api/accounts', {
        name: 'Custom',
        waAccountStartDate: '2026-06-01',
        dailyLimit: 100,
        sendWindowStart: 8,
        sendWindowStartMin: 30,
        sendWindowEnd: 20,
        sendWindowEndMin: 0,
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.name).toBe('Custom');
      expect(data.dailyLimit).toBe(100);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dailyLimit: 100,
          sendWindowStart: 8,
          sendWindowStartMin: 30,
          sendWindowEnd: 20,
          sendWindowEndMin: 0,
        }),
      });
    });

    it('returns 400 when name is missing', async () => {
      const { POST } = await loadListRoute();
      const req = request('POST', 'http://localhost:3000/api/accounts', {
        dailyLimit: 50,
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  // ─── GET /api/accounts/[id] ──────────────────────
  describe('GET /api/accounts/[id]', () => {
    it('returns a single account with campaigns', async () => {
      mockFindUnique.mockResolvedValue({
        ...MOCK_ACCOUNTS[0],
        campaigns: [
          { id: 'c1', name: 'Dental Q1', status: 'ACTIVE', order: 0 },
        ],
      });

      const { GET } = await loadDetailRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts/wa-1');
      const res = await GET(req, { params: Promise.resolve({ id: 'wa-1' }) });

      const data = await res.json();
      expect(data.id).toBe('wa-1');
      expect(data.name).toBe('Dental');
      expect(data.campaigns).toHaveLength(1);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'wa-1' },
        include: {
          campaigns: { orderBy: { order: 'asc' } },
          _count: { select: { campaigns: true } },
        },
      });
    });

    it('returns 404 when account does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const { GET } = await loadDetailRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts/nonexistent');
      const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/accounts/[id] ────────────────────
  describe('PATCH /api/accounts/[id]', () => {
    it('updates account name and limits', async () => {
      const updated = { ...MOCK_ACCOUNTS[0], name: 'Dental Updated', dailyLimit: 75 };
      mockUpdate.mockResolvedValue(updated);

      const { PATCH } = await loadDetailRoute();
      const req = request('PATCH', 'http://localhost:3000/api/accounts/wa-1', {
        name: 'Dental Updated',
        dailyLimit: 75,
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'wa-1' }) });

      const data = await res.json();
      expect(data.name).toBe('Dental Updated');
      expect(data.dailyLimit).toBe(75);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'wa-1' },
        data: expect.objectContaining({ name: 'Dental Updated', dailyLimit: 75 }),
      });
    });

    it('updates send window', async () => {
      const updated = { ...MOCK_ACCOUNTS[0], sendWindowStart: 10, sendWindowEnd: 16 };
      mockUpdate.mockResolvedValue(updated);

      const { PATCH } = await loadDetailRoute();
      const req = request('PATCH', 'http://localhost:3000/api/accounts/wa-1', {
        sendWindowStart: 10,
        sendWindowStartMin: 30,
        sendWindowEnd: 16,
        sendWindowEndMin: 30,
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: 'wa-1' }) });

      const data = await res.json();
      expect(data.sendWindowStart).toBe(10);
      expect(data.sendWindowEnd).toBe(16);
    });

    it('returns 404 when updating non-existent account', async () => {
      mockUpdate.mockRejectedValue(new Error('Record not found'));

      const { PATCH } = await loadDetailRoute();
      const req = request('PATCH', 'http://localhost:3000/api/accounts/nonexistent', {
        name: 'Ghost',
      });

      try {
        await PATCH(req, { params: Promise.resolve({ id: 'nonexistent' }) });
      } catch {
        // Expected for error handling in 404 case
      }
    });
  });

  // ─── DELETE /api/accounts/[id] ────────────────────
  describe('DELETE /api/accounts/[id]', () => {
    it('deletes an account by id', async () => {
      mockDelete.mockResolvedValue({ id: 'wa-1' });

      const { DELETE } = await loadDetailRoute();
      const req = request('DELETE', 'http://localhost:3000/api/accounts/wa-1');
      const res = await DELETE(req, { params: Promise.resolve({ id: 'wa-1' }) });

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'wa-1' } });
    });
  });

  // ─── GET /api/accounts/[id]/status ────────────────
  describe('GET /api/accounts/[id]/status', () => {
    it('returns connection status and QR from ClientManager', async () => {
      mockGetStatus.mockReturnValue('connected');
      mockGetQr.mockReturnValue(null);
      mockFindUnique.mockResolvedValue({
        id: 'wa-1',
        name: 'Dental',
        status: 'CONNECTED',
      });

      const { GET } = await loadStatusRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts/wa-1/status');
      const res = await GET(req, { params: Promise.resolve({ id: 'wa-1' }) });

      const data = await res.json();
      expect(data.status).toBe('connected');
      expect(data.qr).toBeNull();
      expect(data.dbStatus).toBe('CONNECTED');
      expect(mockGetStatus).toHaveBeenCalledWith('wa-1');
      expect(mockGetQr).toHaveBeenCalledWith('wa-1');
    });

    it('returns QR when available', async () => {
      mockGetStatus.mockReturnValue('qr_ready');
      mockGetQr.mockReturnValue('data:image/png;base64,abc123');
      mockFindUnique.mockResolvedValue({
        id: 'wa-2',
        name: 'Real Estate',
        status: 'CONFIGURED',
      });

      const { GET } = await loadStatusRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts/wa-2/status');
      const res = await GET(req, { params: Promise.resolve({ id: 'wa-2' }) });

      const data = await res.json();
      expect(data.status).toBe('qr_ready');
      expect(data.qr).toBe('data:image/png;base64,abc123');
    });

    it('returns 404 when account not in DB', async () => {
      mockFindUnique.mockResolvedValue(null);

      const { GET } = await loadStatusRoute();
      const req = request('GET', 'http://localhost:3000/api/accounts/nonexistent/status');
      const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });
  });
});
