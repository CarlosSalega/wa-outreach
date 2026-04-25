import { NextResponse } from 'next/server';
import { getStatusFromDisk, getQrFromDisk } from '@/lib/whatsapp/client';

export async function GET() {
  const status = getStatusFromDisk();
  const qr = getQrFromDisk();
  return NextResponse.json({ status, qr });
}
