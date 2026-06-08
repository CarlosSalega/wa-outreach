import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockMessageLogCount = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appConfig: { findFirst: mockFindFirst },
    messageLog: { count: mockMessageLogCount },
  },
}));

const NOW = new Date('2026-06-06T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe('getDailyLimit', () => {
  it('devuelve 10 si la cuenta tiene 0-3 días', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(2),
      dailyLimit: 100,
    });

    const { getDailyLimit } = await import('../warmup');
    expect(await getDailyLimit()).toBe(10);
  });

  it('devuelve 20 si la cuenta tiene 4-7 días', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(5),
      dailyLimit: 100,
    });

    const { getDailyLimit } = await import('../warmup');
    expect(await getDailyLimit()).toBe(20);
  });

  it('devuelve 35 si la cuenta tiene 8-14 días', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(10),
      dailyLimit: 100,
    });

    const { getDailyLimit } = await import('../warmup');
    expect(await getDailyLimit()).toBe(35);
  });

  it('devuelve config.dailyLimit después de 14 días', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(20),
      dailyLimit: 80,
    });

    const { getDailyLimit } = await import('../warmup');
    expect(await getDailyLimit()).toBe(80);
  });

  it('devuelve 10 si no hay AppConfig', async () => {
    mockFindFirst.mockResolvedValue(null);

    const { getDailyLimit } = await import('../warmup');
    expect(await getDailyLimit()).toBe(10);
  });
});

describe('hasReachedDailyLimit', () => {
  it('retorna true si count >= limit', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(20),
      dailyLimit: 50,
    });
    mockMessageLogCount.mockResolvedValue(50);

    const { hasReachedDailyLimit } = await import('../warmup');
    expect(await hasReachedDailyLimit()).toBe(true);
  });

  it('retorna false si count < limit', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(20),
      dailyLimit: 50,
    });
    mockMessageLogCount.mockResolvedValue(30);

    const { hasReachedDailyLimit } = await import('../warmup');
    expect(await hasReachedDailyLimit()).toBe(false);
  });

  it('retorna false si no hay mensajes enviados', async () => {
    mockFindFirst.mockResolvedValue({
      waAccountStartDate: daysAgo(20),
      dailyLimit: 50,
    });
    mockMessageLogCount.mockResolvedValue(0);

    const { hasReachedDailyLimit } = await import('../warmup');
    expect(await hasReachedDailyLimit()).toBe(false);
  });
});
