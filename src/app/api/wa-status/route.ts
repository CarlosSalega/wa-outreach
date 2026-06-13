import { NextRequest, NextResponse } from 'next/server';
import { clientManager } from '@/lib/whatsapp/client-manager';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  let accountId = searchParams.get('accountId');

  // If no accountId provided, use the first account (backward compat)
  if (!accountId) {
    const firstAccount = await prisma.whatsAppAccount.findFirst();
    if (!firstAccount) {
      return NextResponse.json({
        status: 'disconnected',
        qr: null,
        message: 'No WhatsApp accounts configured',
      });
    }
    accountId = firstAccount.id;
  }

  const status = clientManager.getStatus(accountId);
  const qr = clientManager.getQr(accountId);

  return NextResponse.json({ status, qr });
}
