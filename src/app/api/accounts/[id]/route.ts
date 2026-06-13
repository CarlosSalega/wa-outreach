import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
    include: {
      campaigns: { orderBy: { order: 'asc' } },
      _count: { select: { campaigns: true } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, waAccountStartDate, dailyLimit, sendWindowStart, sendWindowStartMin, sendWindowEnd, sendWindowEndMin } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (waAccountStartDate !== undefined) updateData.waAccountStartDate = new Date(waAccountStartDate);
  if (dailyLimit !== undefined) updateData.dailyLimit = dailyLimit;
  if (sendWindowStart !== undefined) updateData.sendWindowStart = sendWindowStart;
  if (sendWindowStartMin !== undefined) updateData.sendWindowStartMin = sendWindowStartMin;
  if (sendWindowEnd !== undefined) updateData.sendWindowEnd = sendWindowEnd;
  if (sendWindowEndMin !== undefined) updateData.sendWindowEndMin = sendWindowEndMin;

  const account = await prisma.whatsAppAccount.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(account);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.whatsAppAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
