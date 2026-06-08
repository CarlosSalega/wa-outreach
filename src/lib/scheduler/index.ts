import cron from 'node-cron';
import { isReady } from '../whatsapp/client';
import { hasReachedDailyLimit } from './warmup';
import { processNextContact } from './processContact';
import { prisma } from '../prisma';

export function isWithinSendWindow(
  startH: number, startMin: number,
  endH: number, endMin: number
): boolean {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startMin;
  const endMinutes = endH * 60 + endMin;
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

export function startScheduler(): void {
  cron.schedule('* * * * *', async () => {
    // Leer config de la DB cada iteración
    const config = await prisma.appConfig.findFirst();
    if (!config) return;

    if (!isWithinSendWindow(
      config.sendWindowStart, config.sendWindowStartMin,
      config.sendWindowEnd, config.sendWindowEndMin
    )) return;

    if (!isReady()) {
      console.log('[scheduler] WhatsApp no conectado, esperando...');
      return;
    }

    const limitReached = await hasReachedDailyLimit();
    if (limitReached) return;

    try {
      await processNextContact();
    } catch (err) {
      console.error('[scheduler] Error inesperado:', err);
    }
  });

  console.log(`[scheduler] Iniciado — procesando entre 9:00 y 19:00hs (configurable en Config)`);
}
