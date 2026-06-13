import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: {
      findMany: mockFindMany,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
    $transaction: mockTransaction,
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
    private _body: string;
    constructor(url: string, options?: { method?: string; body?: string }) {
      this._url = url;
      this._body = options?.body ?? '';
    }
    async json() {
      return JSON.parse(this._body || '{}');
    }
    get nextUrl() {
      return new URL(this._url);
    }
  },
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
  return import('../app/api/contacts/route');
}

const MOCK_CONTACTS = [
  { id: 'c1', phone: '541112345678', agencyName: 'Clinic A', status: 'pending', createdAt: new Date() },
  { id: 'c2', phone: '541118765432', agencyName: 'Clinic B', status: 'active', createdAt: new Date() },
];

beforeEach(() => {
  vi.clearAllMocks();
  jsonMock.mockClear();
  mockFindMany.mockReset();
  mockUpsert.mockReset();
  mockDeleteMany.mockReset();
  mockTransaction.mockReset();
});

// ── T11 Tests: Contacts API Update ──────────────────
describe('T11 — Contacts API (multi-account)', () => {
  // ─── GET /api/contacts ──────────────────────────
  describe('GET /api/contacts', () => {
    it('returns all contacts when no filter', async () => {
      mockFindMany.mockResolvedValue(MOCK_CONTACTS);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/contacts');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          agencyName: true,
          status: true,
          contactListId: true,
          createdAt: true,
        },
        where: {},
      });
    });

    it('filters by contactListId query param', async () => {
      mockFindMany.mockResolvedValue([MOCK_CONTACTS[0]]);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/contacts?contactListId=cl-1');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          id: true,
          phone: true,
        }),
        where: { contactListId: 'cl-1' },
      });
    });

    it('returns empty array when no contacts match filter', async () => {
      mockFindMany.mockResolvedValue([]);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/contacts?contactListId=nonexistent');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toEqual([]);
    });
  });

  // ─── POST /api/contacts ─────────────────────────
  describe('POST /api/contacts', () => {
    it('imports contacts with contactListId', async () => {
      const imported = [
        { id: 'new-1', phone: '541119999999', agencyName: 'New Lead', contactListId: 'cl-1' },
      ];
      mockTransaction.mockResolvedValue(imported);

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/contacts', {
        items: [{ phone: '541119999999', agencyName: 'New Lead' }],
        contactListId: 'cl-1',
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.imported).toBe(1);
      expect(data.contacts[0].contactListId).toBe('cl-1');
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('imports contacts without contactListId (backward compatible)', async () => {
      const imported = [
        { id: 'new-2', phone: '541118888888', agencyName: 'Legacy', contactListId: null },
      ];
      mockTransaction.mockResolvedValue(imported);

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/contacts', {
        items: [{ phone: '541118888888', agencyName: 'Legacy' }],
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.imported).toBe(1);
    });

    it('handles flat array input (backward compatible)', async () => {
      mockTransaction.mockResolvedValue([
        { id: 'new-3', phone: '541117777777', agencyName: 'Flat', contactListId: null },
      ]);

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/contacts', [
        { phone: '541117777777', agencyName: 'Flat' },
      ]);
      const res = await POST(req);

      const data = await res.json();
      expect(data.imported).toBe(1);
    });

    it('returns 400 when no valid contacts provided', async () => {
      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/contacts', {
        items: [{ agencyName: 'No phone' }],
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/contacts ───────────────────────
  describe('DELETE /api/contacts', () => {
    it('deletes contacts by ids', async () => {
      mockDeleteMany.mockResolvedValue({ count: 2 });

      const { DELETE } = await loadRoute();
      const req = request('DELETE', 'http://localhost:3000/api/contacts', {
        ids: ['c1', 'c2'],
      });
      const res = await DELETE(req);

      const data = await res.json();
      expect(data.deleted).toBe(2);
      expect(mockDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['c1', 'c2'] } } });
    });
  });
});
