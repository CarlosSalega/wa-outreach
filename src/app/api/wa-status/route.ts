import { NextRequest, NextResponse } from 'next/server';
import { clientManager } from '@/lib/whatsapp/client-manager';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Resolve account: param first, fallback to first account (backward compat)
  const accountId =
    searchParams.get('accountId') ||
    (await prisma.whatsAppAccount.findFirst())?.id;

  if (!accountId) {
    return NextResponse.json({
      status: 'disconnected',
      qr: null,
      message: 'No WhatsApp accounts configured',
    });
  }

  const status = clientManager.getStatus(accountId);
  const qr = clientManager.getQr(accountId);

  return NextResponse.json({ status, qr });
}
