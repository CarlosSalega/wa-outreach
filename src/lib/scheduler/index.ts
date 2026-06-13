import cron from 'node-cron';
import { prisma } from '../prisma';
import { processNextContact, checkCompletion } from './processContact';
import { hasReachedDailyLimit } from './warmup';
import type { ClientManager } from '../whatsapp/client-manager';

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

/**
 * Find the first ACTIVE campaign for an account, ordered by priority.
 */
export async function findActiveCampaign(accountId: string) {
  return prisma.campaign.findFirst({
    where: {
      whatsappAccountId: accountId,
      status: 'ACTIVE',
    },
    orderBy: { order: 'asc' },
  });
}

// ── Per-account cron registry ──────────────────────
const cronTasks = new Map<string, cron.ScheduledTask>();

/**
 * Start a per-account scheduler tick (every minute).
 */
export function startScheduler(
  accountId: string,
  clientManager: ClientManager
): void {
  if (cronTasks.has(accountId)) {
    console.warn(`[scheduler] Scheduler already running for account ${accountId}`);
    return;
  }

  const task = cron.schedule('* * * * *', async () => {
    try {
      // Guard 1: client must be ready
      if (!clientManager.isReady(accountId)) {
        return;
      }

      // Guard 2: get account config for window check
      const account = await prisma.whatsAppAccount.findUnique({
        where: { id: accountId },
      });
      if (!account) return;

      if (!isWithinSendWindow(
        account.sendWindowStart, account.sendWindowStartMin,
        account.sendWindowEnd, account.sendWindowEndMin
      )) return;

      // Guard 3: daily limit
      const limitReached = await hasReachedDailyLimit(accountId);
      if (limitReached) return;

      // Find and process next campaign message
      const campaign = await findActiveCampaign(accountId);
      if (!campaign) return;

      const client = clientManager.getClient(accountId);
      await processNextContact(client);
      await checkCompletion(campaign.id);
    } catch (err) {
      console.error(`[scheduler] Error in tick for account ${accountId}:`, err);
    }
  });

  cronTasks.set(accountId, task);
  console.log(`[scheduler] Started for account ${accountId}`);
}

/**
 * Stop a per-account scheduler.
 */
export function stopScheduler(accountId: string): void {
  const task = cronTasks.get(accountId);
  if (task) {
    task.stop();
    cronTasks.delete(accountId);
    console.log(`[scheduler] Stopped for account ${accountId}`);
  }
}
