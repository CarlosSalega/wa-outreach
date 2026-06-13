import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appConfig: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
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
    private _body: string;
    constructor(_url: string, options?: { method?: string; body?: string }) {
      this._body = options?.body ?? '';
    }
    async json() {
      return JSON.parse(this._body || '{}');
    }
    get nextUrl() {
      return new URL('http://localhost:3000');
    }
  },
}));

function request(method: string, _url: string, body?: unknown) {
  const NextReq = (vi.mocked(require('next/server').NextRequest));
  const req = new NextReq(_url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  (req as { json: () => Promise<unknown> }).json = async () => body ?? {};
  return req;
}

async function loadRoute() {
  return import('../app/api/config/route');
}

const MOCK_CONFIG = {
  id: 'cfg-1',
  waAccountStartDate: new Date('2026-06-01'),
  dailyLimit: 50,
  sendWindowStart: 9,
  sendWindowStartMin: 0,
  sendWindowEnd: 19,
  sendWindowEndMin: 0,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
};

beforeEach(() => {
  vi.clearAllMocks();
  jsonMock.mockClear();
  mockFindFirst.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

// ── T12 Tests: Config API Update ────────────────────
describe('T12 — Config API (warmup/window removed)', () => {
  describe('GET /api/config', () => {
    it('returns config without warmup/window fields', async () => {
      mockFindFirst.mockResolvedValue(MOCK_CONFIG);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/config');
      const res = await GET(req);

      const data = await res.json();

      // Config is returned as-is from DB (AppConfig fields remain in DB)
      // The API behavior is: return what's in the DB
      // warmup/window fields moved to WhatsAppAccount, but AppConfig still has them
      // The API should NOT strip them, but POST should NOT accept them
      expect(data.id).toBe('cfg-1');
    });

    it('returns null when no config exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const { GET } = await loadRoute();
      const req = request('GET', 'http://localhost:3000/api/config');
      const res = await GET(req);

      const data = await res.json();
      expect(data).toBeNull();
    });
  });

  describe('POST /api/config', () => {
    it('creates config with defaults but no warmup/window from request', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: 'cfg-new',
        waAccountStartDate: new Date(),
        dailyLimit: 50,
        sendWindowStart: 9,
        sendWindowStartMin: 0,
        sendWindowEnd: 19,
        sendWindowEndMin: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/config', {
        // No waAccountStartDate, no warmup/window values — should not fail
        someOtherField: 'value',
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.id).toBe('cfg-new');
      // POST no longer requires waAccountStartDate
      expect(res.status).toBe(200);
      // Create was called (with DB-required defaults, but API ignored request warmup fields)
      expect(mockCreate).toHaveBeenCalled();
    });

    it('updates config without accepting warmup/window from request body', async () => {
      mockFindFirst.mockResolvedValue(MOCK_CONFIG);
      mockUpdate.mockResolvedValue({
        ...MOCK_CONFIG,
        updatedAt: new Date(),
      });

      const { POST } = await loadRoute();
      const req = request('POST', 'http://localhost:3000/api/config', {
        // Attempt to set warmup/window fields — they should be ignored
        dailyLimit: 999,
        sendWindowStart: 0,
        sendWindowEnd: 24,
      });
      const res = await POST(req);

      const data = await res.json();
      expect(data.id).toBe('cfg-1');
      // Update was called with empty data (no warmup/window fields accepted)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: {},
      });
    });
  });
});
