import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockGetStatus = vi.fn();
const mockGetQr = vi.fn();
const mockFindFirst = vi.fn();

vi.mock('@/lib/whatsapp/client-manager', () => ({
  clientManager: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getQr: (...args: unknown[]) => mockGetQr(...args),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppAccount: {
      findFirst: mockFindFirst,
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

async function loadRoute() {
  return import('../app/api/wa-status/route');
}

beforeEach(() => {
  vi.clearAllMocks();
  jsonMock.mockClear();
  mockGetStatus.mockReset();
  mockGetQr.mockReset();
  mockFindFirst.mockReset();
});

describe('T13 — Wa-Status API (per-account)', () => {
  describe('GET /api/wa-status', () => {
    it('returns per-account status when accountId query param provided', async () => {
      mockGetStatus.mockReturnValue('connected');
      mockGetQr.mockReturnValue(null);

      const { GET } = await loadRoute();
      const req = request('http://localhost:3000/api/wa-status?accountId=wa-1');
      const res = await GET(req);

      const data = await res.json();
      expect(data.status).toBe('connected');
      expect(data.qr).toBeNull();
      expect(mockGetStatus).toHaveBeenCalledWith('wa-1');
      expect(mockGetQr).toHaveBeenCalledWith('wa-1');
    });

    it('returns first account status when no accountId provided (backward compat)', async () => {
      mockFindFirst.mockResolvedValue({ id: 'wa-default' });
      mockGetStatus.mockReturnValue('connected');
      mockGetQr.mockReturnValue(null);

      const { GET } = await loadRoute();
      const req = request('http://localhost:3000/api/wa-status');
      const res = await GET(req);

      const data = await res.json();
      expect(data.status).toBe('connected');
      expect(mockGetStatus).toHaveBeenCalledWith('wa-default');
    });

    it('handles no accounts gracefully', async () => {
      mockFindFirst.mockResolvedValue(null);

      const { GET } = await loadRoute();
      const req = request('http://localhost:3000/api/wa-status');
      const res = await GET(req);

      const data = await res.json();
      expect(data.status).toBe('disconnected');
      expect(data.message).toBe('No WhatsApp accounts configured');
    });

    it('returns QR when account has QR ready', async () => {
      mockFindFirst.mockResolvedValue({ id: 'wa-1' });
      mockGetStatus.mockReturnValue('qr_ready');
      mockGetQr.mockReturnValue('data:image/png;base64,qrcodedata');

      const { GET } = await loadRoute();
      const req = request('http://localhost:3000/api/wa-status');
      const res = await GET(req);

      const data = await res.json();
      expect(data.status).toBe('qr_ready');
      expect(data.qr).toBe('data:image/png;base64,qrcodedata');
    });
  });
});
