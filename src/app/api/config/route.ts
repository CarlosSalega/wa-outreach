import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const config = await prisma.appConfig.findFirst();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { waAccountStartDate, dailyLimit, sendWindowStart, sendWindowStartMin, sendWindowEnd, sendWindowEndMin } = body;

  if (!waAccountStartDate) {
    return NextResponse.json(
      { error: 'waAccountStartDate es requerido' },
      { status: 400 }
    );
  }

  const existing = await prisma.appConfig.findFirst();

  const config = existing
    ? await prisma.appConfig.update({
        where: { id: existing.id },
        data: {
          dailyLimit: dailyLimit ?? existing.dailyLimit,
          sendWindowStart: sendWindowStart ?? existing.sendWindowStart,
          sendWindowStartMin: sendWindowStartMin ?? existing.sendWindowStartMin,
          sendWindowEnd: sendWindowEnd ?? existing.sendWindowEnd,
          sendWindowEndMin: sendWindowEndMin ?? existing.sendWindowEndMin,
        },
      })
    : await prisma.appConfig.create({
        data: {
          waAccountStartDate: new Date(waAccountStartDate),
          dailyLimit: dailyLimit ?? 50,
          sendWindowStart: sendWindowStart ?? 9,
          sendWindowStartMin: sendWindowStartMin ?? 0,
          sendWindowEnd: sendWindowEnd ?? 19,
          sendWindowEndMin: sendWindowEndMin ?? 0,
        },
      });

  return NextResponse.json(config);
}
