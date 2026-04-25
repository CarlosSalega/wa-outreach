import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      phone: true,
      agencyName: true,
      status: true,
      createdAt: true,
    },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const items = Array.isArray(body) ? body : [body];

  const valid = items.filter(i => i.phone);
  if (!valid.length) {
    return NextResponse.json(
      { error: 'Se requiere al menos un contacto con teléfono' },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(
    valid.map(item =>
      prisma.contact.upsert({
        where: { phone: item.phone.toString().replace(/\D/g, '') },
        update: { agencyName: item.agencyName || '' },
        create: {
          phone: item.phone.toString().replace(/\D/g, ''),
          agencyName: item.agencyName || '',
        },
      })
    )
  );

  return NextResponse.json({ imported: result.length, contacts: result });
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  await prisma.contact.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: ids.length });
}
