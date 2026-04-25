import { prisma } from '../prisma';

export async function getDailyLimit(): Promise<number> {
  const config = await prisma.appConfig.findFirst();

  if (!config) {
    console.warn('[warmup] No hay AppConfig, usando límite mínimo de 10');
    return 10;
  }

  const now = new Date();
  const start = new Date(config.waAccountStartDate);
  const daysSinceStart = Math.floor(
    (now.getTime() - start.getTime()) / 86_400_000
  );

  if (daysSinceStart <= 3)  return 10;
  if (daysSinceStart <= 7)  return 20;
  if (daysSinceStart <= 14) return 35;
  return config.dailyLimit;
}

export async function getDailyCount(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.messageLog.count({
    where: {
      status: 'sent',
      sentAt: { gte: today },
    },
  });
}

export async function hasReachedDailyLimit(): Promise<boolean> {
  const [limit, count] = await Promise.all([
    getDailyLimit(),
    getDailyCount(),
  ]);

  console.log(`[warmup] Enviados hoy: ${count} / límite: ${limit}`);
  return count >= limit;
}
