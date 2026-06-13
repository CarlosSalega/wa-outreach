import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const accounts = await prisma.whatsAppAccount.findMany({
    include: {
      campaigns: true,
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, waAccountStartDate, dailyLimit, sendWindowStart, sendWindowStartMin, sendWindowEnd, sendWindowEndMin } = body;

  if (!name) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  const account = await prisma.whatsAppAccount.create({
    data: {
      name,
      waAccountStartDate: waAccountStartDate ? new Date(waAccountStartDate) : new Date(),
      dailyLimit: dailyLimit ?? 50,
      sendWindowStart: sendWindowStart ?? 9,
      sendWindowStartMin: sendWindowStartMin ?? 0,
      sendWindowEnd: sendWindowEnd ?? 19,
      sendWindowEndMin: sendWindowEndMin ?? 0,
      status: 'CONFIGURED',
    },
  });

  return NextResponse.json(account);
}
