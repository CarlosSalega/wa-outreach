import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appConfig: { findFirst: vi.fn() },
  },
}));

vi.mock('../../whatsapp/client', () => ({
  isReady: vi.fn(),
}));

vi.mock('../warmup', () => ({
  hasReachedDailyLimit: vi.fn(),
}));

vi.mock('../processContact', () => ({
  processNextContact: vi.fn(),
}));

// ── Tests de isWithinSendWindow ────────────────────
// Usamos el constructor Date(año, mesIndex, día, hora, min)
// que interpreta los valores en hora LOCAL, no UTC.
describe('isWithinSendWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna true cuando la hora actual está dentro de la ventana', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 14, 30)); // 14:30 LOCAL

    const { isWithinSendWindow } = await import('../index');
    expect(isWithinSendWindow(9, 0, 19, 0)).toBe(true);
  });

  it('retorna false cuando está antes de la ventana', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 7, 0)); // 7:00 LOCAL

    const { isWithinSendWindow } = await import('../index');
    expect(isWithinSendWindow(9, 0, 19, 0)).toBe(false);
  });

  it('retorna false cuando está después de la ventana', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 20, 0)); // 20:00 LOCAL

    const { isWithinSendWindow } = await import('../index');
    expect(isWithinSendWindow(9, 0, 19, 0)).toBe(false);
  });

  it('respeta minutos en sendWindowStart', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 9, 15)); // 9:15 LOCAL

    // Ventana empieza a las 9:30
    expect((await import('../index')).isWithinSendWindow(9, 30, 19, 0)).toBe(false);
  });

  it('respeta minutos en sendWindowEnd', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 18, 45)); // 18:45 LOCAL

    // Ventana termina a las 18:30
    expect((await import('../index')).isWithinSendWindow(9, 0, 18, 30)).toBe(false);
  });

  it('incluye el inicio exacto de la ventana', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 9, 0)); // 9:00 LOCAL

    const { isWithinSendWindow } = await import('../index');
    expect(isWithinSendWindow(9, 0, 19, 0)).toBe(true);
  });

  it('excluye el fin exacto de la ventana', async () => {
    vi.setSystemTime(new Date(2026, 5, 6, 19, 0)); // 19:00 LOCAL

    const { isWithinSendWindow } = await import('../index');
    expect(isWithinSendWindow(9, 0, 19, 0)).toBe(false);
  });
});
