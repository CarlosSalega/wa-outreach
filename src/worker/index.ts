import { clientManager, waEvents } from '../lib/whatsapp/client-manager';
import { startScheduler, stopScheduler } from '../lib/scheduler';

async function main(): Promise<void> {
  console.log('[worker] Iniciando...');

  // Per-account ready → start scheduler for that account
  waEvents.on('ready', (accountId: string) => {
    console.log(`[worker] WhatsApp listo para ${accountId} — arrancando scheduler`);
    startScheduler(accountId, clientManager);
  });

  // Per-account disconnect → stop scheduler for that account
  waEvents.on('disconnected', (accountId: string, reason: string) => {
    console.warn(`[worker] Cuenta ${accountId} desconectada: ${reason}`);
    stopScheduler(accountId);
  });

  // Initialize all configured accounts
  await clientManager.initializeAll();
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
