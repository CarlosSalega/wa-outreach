import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');
import QRCode from 'qrcode';
import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { writeFileSync, readFileSync, existsSync } from 'fs';

export const waEvents = new EventEmitter();

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

const STATUS_FILE = './.wa-status.json';

function writeStatus(status: ConnectionStatus, qr: string | null) {
  writeFileSync(STATUS_FILE, JSON.stringify({
    status,
    qr,
    lastUpdate: new Date().toISOString(),
  }));
}

export function getStatusFromDisk(): ConnectionStatus {
  try {
    if (!existsSync(STATUS_FILE)) return 'disconnected';
    const data = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'));
    return data.status;
  } catch {
    return 'disconnected';
  }
}

export function getQrFromDisk(): string | null {
  try {
    if (!existsSync(STATUS_FILE)) return null;
    const data = JSON.parse(readFileSync(STATUS_FILE, 'utf-8'));
    return data.qr;
  } catch {
    return null;
  }
}

let client: Client | null = null;
let status: ConnectionStatus = 'disconnected';
let currentQr: string | null = null;

export function getStatus(): ConnectionStatus {
  return status;
}

export function getCurrentQr(): string | null {
  return currentQr;
}

export function isReady(): boolean {
  return status === 'connected';
}

export function getClient(): Client {
  if (client) return client;

  status = 'connecting';
  writeStatus('connecting', null);

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './wa-session',
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    },
  });

  client.on('qr', async (qr) => {
    currentQr = qr;
    status = 'qr_ready';
    const qrPath = './wa-qr.png';
    await QRCode.toFile(qrPath, qr);
    writeStatus('qr_ready', qrPath);
    waEvents.emit('qr', qr);
    console.log('📱 QR generado en: wa-qr.png');
    console.log('   Se abrirá automáticamente...');
    exec(`xdg-open ${qrPath}`);
  });

  client.on('authenticated', () => {
    console.log('Sesión restaurada correctamente');
    currentQr = null;
  });

  client.on('ready', () => {
    status = 'connected';
    currentQr = null;
    writeStatus('connected', null);
    waEvents.emit('ready');
    console.log('WhatsApp conectado y listo');
  });

  client.on('disconnected', (reason) => {
    status = 'disconnected';
    currentQr = null;
    writeStatus('disconnected', null);
    waEvents.emit('disconnected', reason);
    console.warn('WhatsApp desconectado:', reason);
    client = null;
  });

  client.on('auth_failure', (message) => {
    status = 'disconnected';
    client = null;
    waEvents.emit('auth_failure', message);
    console.error('Error de autenticación WhatsApp:', message);
  });

  client.initialize();
  return client;
}
