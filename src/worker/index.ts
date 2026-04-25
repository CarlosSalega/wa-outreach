import { getClient, waEvents } from '../lib/whatsapp/client';
import { startScheduler } from '../lib/scheduler';

console.log('[worker] Iniciando...');

getClient();

waEvents.once('ready', () => {
  console.log('[worker] WhatsApp listo — arrancando scheduler');
  startScheduler();
});
