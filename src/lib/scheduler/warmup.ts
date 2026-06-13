import { prisma } from '../prisma';

export async function getDailyLimit(accountId: string): Promise<number> {
  const account = await prisma.whatsAppAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    console.warn(`[warmup] Account ${accountId} not found, usando límite mínimo de 10`);
    return 10;
  }

  const now = new Date();
  const start = new Date(account.waAccountStartDate);
  const daysSinceStart = Math.floor(
    (now.getTime() - start.getTime()) / 86_400_000
  );

  if (daysSinceStart <= 3)  return 10;
  if (daysSinceStart <= 7)  return 20;
  if (daysSinceStart <= 14) return 35;
  return account.dailyLimit;
}

export async function getDailyCount(accountId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.messageLog.count({
    where: {
      status: 'sent',
      sentAt: { gte: today },
      messageQueue: {
        campaign: {
          whatsappAccountId: accountId,
        },
      },
    },
  });
}

export async function hasReachedDailyLimit(accountId: string): Promise<boolean> {
  const [limit, count] = await Promise.all([
    getDailyLimit(accountId),
    getDailyCount(accountId),
  ]);

  console.log(`[warmup] Account ${accountId}: ${count} / ${limit}`);
  return count >= limit;
}
