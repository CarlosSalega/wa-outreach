import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [sentToday, failedToday, pendingTotal, campaign] = await Promise.all([
    prisma.messageLog.count({
      where: { status: 'sent', sentAt: { gte: today } },
    }),
    prisma.messageLog.count({
      where: { status: 'failed', sentAt: { gte: today } },
    }),
    prisma.messageQueue.count({
      where: { status: 'PENDING' },
    }),
    prisma.campaign.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, status: true },
    }),
  ]);

  return NextResponse.json({ sentToday, failedToday, pendingTotal, campaign });
}
