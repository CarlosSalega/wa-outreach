import { prisma } from '../prisma';
import { sendMessageSequence } from '../whatsapp/sender';

export async function processNextContact(): Promise<void> {
  const job = await prisma.messageQueue.findFirst({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      contact: true,
      campaign: true,
    },
  });

  if (!job) return;

  await prisma.messageQueue.update({
    where: { id: job.id },
    data: { status: 'PROCESSING' },
  });

  const result = await sendMessageSequence(
    job.contact.phone,
    [job.bodySnapshot],
    job.campaign.delayMinSec,
    job.campaign.delayMaxSec,
  );

  if (result.success) {
    await prisma.messageQueue.update({
      where: { id: job.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    await prisma.messageLog.create({
      data: {
        messageQueueId: job.id,
        status: 'sent',
        sentAt: new Date(),
      },
    });

  } else {
    const newAttempts = job.attempts + 1;
    const giveUp = newAttempts >= 3;

    await prisma.messageQueue.update({
      where: { id: job.id },
      data: {
        status: giveUp ? 'FAILED' : 'PENDING',
        attempts: newAttempts,
        errorMessage: result.error,
        scheduledAt: giveUp
          ? job.scheduledAt
          : new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    if (giveUp) {
      await prisma.messageLog.create({
        data: {
          messageQueueId: job.id,
          status: 'failed',
          sentAt: new Date(),
          errorCode: result.error,
        },
      });

      await checkAndPauseCampaign(job.campaignId);
    }
  }
}

async function checkAndPauseCampaign(campaignId: string): Promise<void> {
  const recentFails = await prisma.messageQueue.count({
    where: {
      campaignId,
      status: 'FAILED',
      updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (recentFails >= 5) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'PAUSED',
        pauseReason: 'Demasiados errores consecutivos — revisá la conexión de WhatsApp',
      },
    });
    console.warn(`[scheduler] Campaña ${campaignId} pausada por errores consecutivos`);
  }
}
