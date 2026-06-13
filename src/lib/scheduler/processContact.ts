import { prisma } from '../prisma';
import { sendMessageSequence } from '../whatsapp/sender';

/**
 * Process the next PENDING message for a campaign using the given WhatsApp client.
 * Accepts a client object (multi-account support) for the sender.
 */
export async function processNextContact(
  client: { sendMessage: (chatId: string, message: string) => Promise<unknown> }
): Promise<void> {
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
    client,
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

  // After processing, check if campaign is complete
  await checkCompletion(job.campaignId);
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

/**
 * Check if a campaign has completed all its messages.
 * If no PENDING messages remain, reset any stuck PROCESSING (>10 min),
 * then re-check. If still 0 pending, mark campaign as DONE.
 */
export async function checkCompletion(campaignId: string): Promise<void> {
  const pendingCount = await prisma.messageQueue.count({
    where: {
      campaignId,
      status: 'PENDING',
    },
  });

  if (pendingCount > 0) return;

  // No PENDING — reset stuck PROCESSING messages (>10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.messageQueue.updateMany({
    where: {
      campaignId,
      status: 'PROCESSING',
      updatedAt: { lt: tenMinutesAgo },
    },
    data: {
      status: 'PENDING',
      scheduledAt: new Date(),
      errorMessage: 'Reset by completion detection (stuck >10 min)',
    },
  });

  // Re-check pending count after reset
  const afterResetCount = await prisma.messageQueue.count({
    where: {
      campaignId,
      status: 'PENDING',
    },
  });

  if (afterResetCount === 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'DONE' },
    });
    console.log(`[scheduler] Campaign ${campaignId} completed — marked DONE`);
  }
}
