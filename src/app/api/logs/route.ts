import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page  = parseInt(searchParams.get('page')  ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const skip  = (page - 1) * limit;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [logs, total] = await Promise.all([
    prisma.messageLog.findMany({
      where: { sentAt: { gte: today } },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      include: {
        messageQueue: {
          include: {
            contact: {
              select: { agencyName: true, phone: true },
            },
          },
        },
      },
    }),
    prisma.messageLog.count({
      where: { sentAt: { gte: today } },
    }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
