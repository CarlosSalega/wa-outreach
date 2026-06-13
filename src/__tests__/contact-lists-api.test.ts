import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contactList: {
      findMany: mockFindMany,
    },
  },
}));

// ── Mock Next.js APIs ──────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}));

// ── Dynamic import after mocks ────────────────────
async function loadRoute() {
  return import('../app/api/contact-lists/route');
}

describe('GET /api/contact-lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all contact lists ordered by createdAt desc', async () => {
    const lists = [
      { id: 'list-2', name: 'Reagendamiento', campaignId: 'camp-2', createdAt: '2026-06-12T00:00:00.000Z' },
      { id: 'list-1', name: 'Dental Leads', campaignId: 'camp-1', createdAt: '2026-06-10T00:00:00.000Z' },
    ];
    mockFindMany.mockResolvedValue(lists);

    const { GET } = await loadRoute();
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(lists);
    expect(mockFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        campaignId: true,
        createdAt: true,
      },
    });
  });

  it('returns empty array when no lists exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const { GET } = await loadRoute();
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('selects only id, name, campaignId, createdAt fields', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'list-1', name: 'Test', campaignId: 'camp-1', createdAt: new Date() },
    ]);

    const { GET } = await loadRoute();
    await GET();

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.select).toEqual({
      id: true,
      name: true,
      campaignId: true,
      createdAt: true,
    });
  });
});
