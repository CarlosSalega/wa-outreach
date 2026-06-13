import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientManager } from '@/lib/whatsapp/client-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { id },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const connectionStatus = clientManager.getStatus(id);
  const qr = clientManager.getQr(id);

  return NextResponse.json({
    status: connectionStatus,
    qr,
    dbStatus: account.status,
  });
}
