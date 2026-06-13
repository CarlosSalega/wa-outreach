import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [sentToday, failedToday, pendingTotal, campaigns, accounts] = await Promise.all([
    prisma.messageLog.count({
      where: { status: 'sent', sentAt: { gte: today } },
    }),
    prisma.messageLog.count({
      where: { status: 'failed', sentAt: { gte: today } },
    }),
    prisma.messageQueue.count({
      where: { status: 'PENDING' },
    }),
    prisma.campaign.findMany({
      select: { id: true, name: true, status: true, whatsappAccountId: true },
    }),
    prisma.whatsAppAccount.findMany({
      select: { id: true, name: true, status: true },
    }),
  ]);

  // Per-account breakdown: count sent, failed, pending for each account
  const byAccount = await Promise.all(
    accounts.map(async (account) => {
      // Count messages for campaigns belonging to this account
      const accountCampaignIds = (
        await prisma.campaign.findMany({
          where: { whatsappAccountId: account.id },
          select: { id: true },
        })
      ).map(c => c.id);

      const sent = accountCampaignIds.length > 0
        ? await prisma.messageLog.count({
            where: {
              status: 'sent',
              sentAt: { gte: today },
              messageQueue: { campaignId: { in: accountCampaignIds } },
            },
          })
        : 0;

      const failed = accountCampaignIds.length > 0
        ? await prisma.messageLog.count({
            where: {
              status: 'failed',
              sentAt: { gte: today },
              messageQueue: { campaignId: { in: accountCampaignIds } },
            },
          })
        : 0;

      const pending = accountCampaignIds.length > 0
        ? await prisma.messageQueue.count({
            where: {
              status: 'PENDING',
              campaignId: { in: accountCampaignIds },
            },
          })
        : 0;

      return {
        id: account.id,
        name: account.name,
        status: account.status,
        sent,
        failed,
        pending,
        campaigns: accountCampaignIds.length,
      };
    })
  );

  return NextResponse.json({
    sentToday,
    failedToday,
    pendingTotal,
    campaigns,
    byAccount,
  });
}
