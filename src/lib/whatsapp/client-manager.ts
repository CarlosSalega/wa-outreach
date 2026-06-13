import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');
import { EventEmitter } from 'events';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { prisma } from '@/lib/prisma';

export const waEvents = new EventEmitter();

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

interface ClientSession {
  client: InstanceType<typeof Client>;
  status: ConnectionStatus;
  qr: string | null;
  sessionPath: string;
}

function writeStatus(sessionPath: string, status: ConnectionStatus, qr: string | null): void {
  try {
    mkdirSync(sessionPath, { recursive: true });
    writeFileSync(
      `${sessionPath}.status.json`,
      JSON.stringify({
        status,
        qr,
        lastUpdate: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.error(`[ClientManager] Error writing status for ${sessionPath}:`, err);
  }
}

function readStatusFromDisk(sessionPath: string): ConnectionStatus | null {
  try {
    if (!existsSync(`${sessionPath}.status.json`)) return null;
    const data = JSON.parse(readFileSync(`${sessionPath}.status.json`, 'utf-8'));
    return data.status as ConnectionStatus;
  } catch {
    return null;
  }
}

export class ClientManager {
  private sessions: Map<string, ClientSession> = new Map();

  getClient(id: string): InstanceType<typeof Client> {
    const existing = this.sessions.get(id);
    if (existing) return existing.client;

    const sessionPath = `./wa-sessions/${id}/`;

    const session: ClientSession = {
      client: null as unknown as InstanceType<typeof Client>,
      status: 'connecting',
      qr: null,
      sessionPath,
    };

    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionPath,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--disable-gpu',
        ],
      },
    });

    client.on('qr', (qr: string) => {
      session.qr = qr;
      session.status = 'qr_ready';
      writeStatus(sessionPath, 'qr_ready', qr);
      waEvents.emit('qr', id, qr);
    });

    client.on('authenticated', () => {
      session.qr = null;
    });

    client.on('ready', () => {
      session.status = 'connected';
      session.qr = null;
      writeStatus(sessionPath, 'connected', null);
      waEvents.emit('ready', id);
    });

    client.on('disconnected', (reason: string) => {
      session.status = 'disconnected';
      session.qr = null;
      writeStatus(sessionPath, 'disconnected', null);
      waEvents.emit('disconnected', id, reason);
    });

    client.on('auth_failure', (message: string) => {
      session.status = 'disconnected';
      session.qr = null;
      waEvents.emit('auth_failure', id, message);
    });

    session.client = client;
    this.sessions.set(id, session);

    client.initialize();
    return client;
  }

  isReady(id: string): boolean {
    const session = this.sessions.get(id);
    return session?.status === 'connected' ?? false;
  }

  getStatus(id: string): ConnectionStatus {
    const session = this.sessions.get(id);
    if (session) return session.status;

    // Fall back to disk status when session not in memory
    const sessionPath = `./wa-sessions/${id}/`;
    const diskStatus = readStatusFromDisk(sessionPath);
    return diskStatus ?? 'disconnected';
  }

  getQr(id: string): string | null {
    const session = this.sessions.get(id);
    return session?.qr ?? null;
  }

  async initializeAll(): Promise<void> {
    const accounts = await prisma.whatsAppAccount.findMany();
    for (const account of accounts) {
      if (!this.sessions.has(account.id)) {
        this.getClient(account.id);
      }
    }
  }

  async destroy(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    try {
      await session.client.destroy();
    } catch (err) {
      console.error(`[ClientManager] Error destroying session ${id}:`, err);
    }
    this.sessions.delete(id);
  }
}

/**
 * Singleton instance used by the worker, API routes, and the scheduler.
 * Shares one in-memory map of sessions across the process.
 */
export const clientManager = new ClientManager();
