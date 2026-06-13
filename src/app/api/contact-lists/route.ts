import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const lists = await prisma.contactList.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      campaignId: true,
      createdAt: true,
    },
  });
  return NextResponse.json(lists);
}
