import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────
// whatsapp-web.js loaded via require() — must intercept createRequire from node:module
const mockOn = vi.fn();
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn().mockResolvedValue(undefined);

const MockClient = vi.fn(function (this: any) {
  this.on = mockOn;
  this.initialize = mockInitialize;
  this.destroy = mockDestroy;
  return this;
});

const MockLocalAuth = vi.fn(function (this: any) {
  return this;
});

// Mock node:module's createRequire so that require('whatsapp-web.js') returns our mocks
vi.mock('node:module', () => {
  return {
    createRequire: () => {
      return (specifier: string) => {
        if (specifier === 'whatsapp-web.js') {
          return { Client: MockClient, LocalAuth: MockLocalAuth };
        }
        throw new Error(`Unexpected require of "${specifier}" in test`);
      };
    },
  };
});

// fs mocks: track file I/O for status persistence
const mockWriteFileSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockMkdirSync = vi.fn();

vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

// Prisma mock
const mockFindManyAccounts = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppAccount: { findMany: mockFindManyAccounts },
  },
}));

// ── Import after all mocks are set up ─────────────
let ClientManager: typeof import('../lib/whatsapp/client-manager').ClientManager;
let waEvents: typeof import('../lib/whatsapp/client-manager').waEvents;

async function loadModule() {
  const mod = await import('../lib/whatsapp/client-manager');
  ClientManager = mod.ClientManager;
  waEvents = mod.waEvents;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  mockInitialize.mockResolvedValue(undefined);
  mockDestroy.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────
describe('T04 — ClientManager', () => {
  describe('constructor', () => {
    it('creates a new manager with no sessions', async () => {
      await loadModule();
      const manager = new ClientManager();

      // Unknown account returns disconnected
      expect(manager.getStatus('unknown')).toBe('disconnected');
      expect(manager.isReady('unknown')).toBe(false);
      expect(manager.getQr('unknown')).toBe(null);
    });
  });

  describe('getClient — lazy initialization', () => {
    it('creates a new WhatsApp Client with per-account session path', async () => {
      await loadModule();
      const manager = new ClientManager();

      const client = manager.getClient('account-1');

      // Client constructor was called
      expect(MockClient).toHaveBeenCalledTimes(1);

      // LocalAuth dataPath should point to ./wa-sessions/{id}/
      const clientCallArgs = MockClient.mock.calls[0][0];
      expect(clientCallArgs.authStrategy).toBeDefined();
      expect(MockLocalAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          dataPath: './wa-sessions/account-1/',
        }),
      );

      // Puppeteer args must include single-process and disable-gpu
      expect(clientCallArgs.puppeteer).toBeDefined();
      expect(clientCallArgs.puppeteer.args).toEqual(
        expect.arrayContaining(['--single-process', '--disable-gpu']),
      );

      // Headless mode
      expect(clientCallArgs.puppeteer.headless).toBe(true);

      // initialize() must be called
      expect(mockInitialize).toHaveBeenCalledTimes(1);

      // Returns the client instance
      expect(client).toBeDefined();
    });

    it('returns the same client on subsequent calls (caching)', async () => {
      await loadModule();
      const manager = new ClientManager();

      const client1 = manager.getClient('account-1');
      const client2 = manager.getClient('account-1');

      // Should be the same instance
      expect(client1).toBe(client2);

      // Client constructor only called once
      expect(MockClient).toHaveBeenCalledTimes(1);
    });

    it('creates independent clients for different accounts', async () => {
      await loadModule();
      const manager = new ClientManager();

      const clientA = manager.getClient('acc-a');
      const clientB = manager.getClient('acc-b');

      expect(clientA).not.toBe(clientB);
      expect(MockClient).toHaveBeenCalledTimes(2);

      // Second call uses different session path
      const secondCallArgs = MockClient.mock.calls[1][0];
      expect(MockLocalAuth).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ dataPath: './wa-sessions/acc-b/' }),
      );
    });
  });

  describe('isReady', () => {
    it('returns false when session is not connected', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');
      // Session just created, status is 'connecting'
      expect(manager.isReady('account-1')).toBe(false);
    });

    it('returns false for unknown account id', async () => {
      await loadModule();
      const manager = new ClientManager();

      expect(manager.isReady('unknown')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns "connecting" after getClient is called', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');
      expect(manager.getStatus('account-1')).toBe('connecting');
    });

    it('returns "connected" after ready event fires', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');

      // Simulate the 'ready' event: find the callback registered for 'ready'
      const readyCallback = getEventHandler('ready');
      expect(readyCallback).toBeDefined();
      readyCallback();

      expect(manager.getStatus('account-1')).toBe('connected');
      expect(manager.isReady('account-1')).toBe(true);
    });

    it('returns "qr_ready" after QR event fires', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');

      const qrCallback = getEventHandler('qr');
      expect(qrCallback).toBeDefined();
      qrCallback('qr-data-base64');

      expect(manager.getStatus('account-1')).toBe('qr_ready');
    });

    it('returns "disconnected" after disconnect event fires', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');

      // Simulate ready first
      const readyCallback = getEventHandler('ready');
      readyCallback();
      expect(manager.getStatus('account-1')).toBe('connected');

      // Then disconnect
      const disconnectCallback = getEventHandler('disconnected');
      disconnectCallback('reconnecting');
      expect(manager.getStatus('account-1')).toBe('disconnected');
    });

    it('falls back to disk status when session not in memory', async () => {
      await loadModule();
      const manager = new ClientManager();

      // Simulate a previously-persisted status on disk
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        status: 'connected',
        qr: null,
        lastUpdate: new Date().toISOString(),
      }));

      const status = manager.getStatus('disk-account');
      expect(status).toBe('connected');
    });

    it('returns "disconnected" when disk status file is missing', async () => {
      await loadModule();
      const manager = new ClientManager();

      mockExistsSync.mockReturnValue(false);

      const status = manager.getStatus('no-disk-account');
      expect(status).toBe('disconnected');
    });
  });

  describe('getQr', () => {
    it('returns null when no QR is available', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');
      expect(manager.getQr('account-1')).toBe(null);
    });

    it('returns the QR data after QR event', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');

      const qrCallback = getEventHandler('qr');
      qrCallback('base64-qr-data');

      expect(manager.getQr('account-1')).toBe('base64-qr-data');
    });

    it('returns null for unknown account', async () => {
      await loadModule();
      const manager = new ClientManager();

      expect(manager.getQr('unknown')).toBe(null);
    });
  });

  describe('initializeAll', () => {
    it('initializes clients for all WhatsAppAccount records', async () => {
      await loadModule();
      const manager = new ClientManager();

      mockFindManyAccounts.mockResolvedValue([
        { id: 'wa-1', name: 'Account 1' },
        { id: 'wa-2', name: 'Account 2' },
      ]);

      await manager.initializeAll();

      // Both accounts initialized
      expect(MockClient).toHaveBeenCalledTimes(2);

      // Verify session paths
      expect(MockLocalAuth).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ dataPath: './wa-sessions/wa-1/' }),
      );
      expect(MockLocalAuth).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ dataPath: './wa-sessions/wa-2/' }),
      );
    });

    it('skips already-initialized accounts', async () => {
      await loadModule();
      const manager = new ClientManager();

      mockFindManyAccounts.mockResolvedValue([
        { id: 'wa-1', name: 'Account 1' },
        { id: 'wa-2', name: 'Account 2' },
      ]);

      // Pre-initialize wa-1
      manager.getClient('wa-1');
      expect(MockClient).toHaveBeenCalledTimes(1);

      // Now initializeAll
      await manager.initializeAll();

      // Only wa-2 should get newly initialized (wa-1 already exists)
      expect(MockClient).toHaveBeenCalledTimes(2);

      // wa-1 was NOT re-initialized (LocalAuth called only once for wa-1)
      const wa1Calls = MockLocalAuth.mock.calls.filter(
        ([args]: [any]) => args?.dataPath === './wa-sessions/wa-1/',
      );
      expect(wa1Calls.length).toBe(1);
    });

    it('handles empty account list gracefully', async () => {
      await loadModule();
      const manager = new ClientManager();

      mockFindManyAccounts.mockResolvedValue([]);

      await manager.initializeAll();

      // No clients created
      expect(MockClient).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('calls client.destroy() and removes the session', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');
      expect(manager.getStatus('account-1')).toBe('connecting');

      await manager.destroy('account-1');

      // destroy was called
      expect(mockDestroy).toHaveBeenCalledTimes(1);

      // Session is now gone
      expect(manager.getStatus('account-1')).toBe('disconnected');
    });

    it('is a no-op for unknown account', async () => {
      await loadModule();
      const manager = new ClientManager();

      await manager.destroy('unknown');

      // No destroy called
      expect(mockDestroy).not.toHaveBeenCalled();
    });
  });

  describe('status persistence', () => {
    it('writes .status.json to session path on ready event', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-1');

      const readyCallback = getEventHandler('ready');
      readyCallback();

      // mkdirSync and writeFileSync should have been called
      expect(mockMkdirSync).toHaveBeenCalledWith(
        './wa-sessions/account-1/',
        expect.objectContaining({ recursive: true }),
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        './wa-sessions/account-1/.status.json',
        expect.stringContaining('"status":"connected"'),
      );
    });

    it('writes .status.json to session path on disconnected event', async () => {
      await loadModule();
      const manager = new ClientManager();

      manager.getClient('account-2');

      const disconnectCallback = getEventHandler('disconnected');
      disconnectCallback('logged-out');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.status.json'),
        expect.stringContaining('"status":"disconnected"'),
      );
    });
  });

  describe('EventEmitter integration', () => {
    it('emits events via waEvents with account id', async () => {
      await loadModule();
      const manager = new ClientManager();

      // Spy on waEvents.emit
      const emitSpy = vi.spyOn(waEvents, 'emit');

      manager.getClient('ev-account');

      const readyCallback = getEventHandler('ready');
      readyCallback();

      expect(emitSpy).toHaveBeenCalledWith('ready', 'ev-account');
    });
  });
});

// ── Helper: find event handler registered via client.on() ──
function getEventHandler(event: string): (...args: unknown[]) => void {
  for (const call of mockOn.mock.calls) {
    if (call[0] === event) {
      return call[1] as (...args: unknown[]) => void;
    }
  }
  throw new Error(`No handler registered for event: ${event}`);
}
