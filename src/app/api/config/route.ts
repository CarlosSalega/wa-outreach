import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const config = await prisma.appConfig.findFirst();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Warmup/window fields are now per-account in WhatsAppAccount — ignore them here
  const existing = await prisma.appConfig.findFirst();

  // Only pass through fields that aren't warmup/window related
  // For now, there are no remaining global settings beyond warmup/window
  // If no warmup/window fields are sent, this API becomes a no-op for AppConfig
  // (kept for backward compatibility and future global settings)
  const config = existing
    ? await prisma.appConfig.update({
        where: { id: existing.id },
        data: {}, // No global settings to update — warmup/window moved to WhatsAppAccount
      })
    : await prisma.appConfig.create({
        data: {
          waAccountStartDate: new Date(),
          dailyLimit: 50,
          sendWindowStart: 9,
          sendWindowStartMin: 0,
          sendWindowEnd: 19,
          sendWindowEndMin: 0,
        },
      });

  return NextResponse.json(config);
}
