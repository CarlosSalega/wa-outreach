import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Helpers: create a mock WhatsApp client ─────────
function createMockClient() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

async function loadModule() {
  const mod = await import('../sender');
  return mod;
}

// ── Tests: formatPhone (pure function) ─────────────
describe('formatPhone — pure function', () => {
  it('adds 54 prefix when phone has no country code', async () => {
    const { formatPhone } = await loadModule();
    expect(formatPhone('1122334455')).toBe('541122334455@c.us');
  });

  it('preserves 54 prefix when already present', async () => {
    const { formatPhone } = await loadModule();
    expect(formatPhone('541122334455')).toBe('541122334455@c.us');
  });

  it('converts leading 0 to 54 prefix', async () => {
    const { formatPhone } = await loadModule();
    expect(formatPhone('01122334455')).toBe('541122334455@c.us');
  });

  it('keeps @c.us suffix when already present', async () => {
    const { formatPhone } = await loadModule();
    expect(formatPhone('541122334455@c.us')).toBe('541122334455@c.us');
  });

  it('strips non-digit characters', async () => {
    const { formatPhone } = await loadModule();
    expect(formatPhone('+54 11-2233-4455')).toBe('541122334455@c.us');
  });
});

// ── Tests: sendMessageSequence (refactored) ────────
describe('sendMessageSequence — client param', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a single message and returns success', async () => {
    const { sendMessageSequence } = await loadModule();
    const mockClient = createMockClient();

    const result = await sendMessageSequence(
      mockClient,
      '541112345678',
      ['Hello {{name}}'],
      30,
      45,
    );

    expect(result.success).toBe(true);
    expect(result.messagesSent).toBe(1);
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockClient.sendMessage).toHaveBeenCalledWith(
      '541112345678@c.us',
      'Hello {{name}}',
    );
  });

  it('sends multiple messages with delays', async () => {
    const { sendMessageSequence } = await loadModule();
    const mockClient = createMockClient();

    // Deterministic Math.random to guarantee 1000ms delays
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const sendPromise = sendMessageSequence(
      mockClient,
      '541112345678',
      ['Msg 1', 'Msg 2', 'Msg 3'],
      1,
      2,
    );

    // First message sent immediately (before delay)
    await vi.advanceTimersByTimeAsync(0);
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(1);

    // After 1000ms → second message
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);

    // After another 1000ms → third message
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(3);

    const result = await sendPromise;
    expect(result.success).toBe(true);
    expect(result.messagesSent).toBe(3);

    randomSpy.mockRestore();
  });

  it('returns error when messages array is empty', async () => {
    const { sendMessageSequence } = await loadModule();
    const mockClient = createMockClient();

    const result = await sendMessageSequence(
      mockClient,
      '541112345678',
      [],
      30,
      45,
    );

    expect(result.success).toBe(false);
    expect(result.messagesSent).toBe(0);
    expect(result.error).toBe('No hay mensajes para enviar');
    expect(mockClient.sendMessage).not.toHaveBeenCalled();
  });

  it('returns error when sendMessage throws', async () => {
    const { sendMessageSequence } = await loadModule();
    const mockClient = createMockClient();
    mockClient.sendMessage.mockRejectedValue(new Error('Network error'));

    const result = await sendMessageSequence(
      mockClient,
      '541112345678',
      ['Msg 1', 'Msg 2'],
      0,
      0,
    );

    expect(result.success).toBe(false);
    expect(result.messagesSent).toBe(0);
    expect(result.error).toBe('Network error');
  });

  it('returns partial count when error occurs mid-sequence', async () => {
    const { sendMessageSequence } = await loadModule();
    const mockClient = createMockClient();

    // First call succeeds, second fails
    mockClient.sendMessage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Timeout'));

    const resultPromise = sendMessageSequence(
      mockClient,
      '541112345678',
      ['Msg 1', 'Msg 2', 'Msg 3'],
      0,
      0,
    );

    // Advance timers to flush sleep(0) calls caused by delayMinSec=delayMaxSec=0
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // First message was sent (messagesSent=1), then error on second
    expect(result.success).toBe(false);
    expect(result.messagesSent).toBe(1);
    expect(result.error).toBe('Timeout');
    expect(mockClient.sendMessage).toHaveBeenCalledTimes(2);
  });
});
