import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const contactListId = searchParams.get('contactListId');

  const where = contactListId ? { contactListId } : {};

  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
    where,
    select: {
      id: true,
      phone: true,
      agencyName: true,
      status: true,
      contactListId: true,
      createdAt: true,
    },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Support new format { items: [...], contactListId } and old flat-array format
  const contactListId = typeof body === 'object' && !Array.isArray(body) ? body.contactListId : undefined;
  const rawItems = typeof body === 'object' && !Array.isArray(body) && Array.isArray(body.items)
    ? body.items
    : Array.isArray(body) ? body : [body];

  const valid = rawItems.filter((i: Record<string, unknown>) => i.phone);
  if (!valid.length) {
    return NextResponse.json(
      { error: 'Se requiere al menos un contacto con teléfono' },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(
    valid.map((item: Record<string, unknown>) =>
      prisma.contact.upsert({
        where: { phone: String(item.phone).replace(/\D/g, '') },
        update: {
          agencyName: String(item.agencyName || ''),
          ...(contactListId ? { contactListId } : {}),
        },
        create: {
          phone: String(item.phone).replace(/\D/g, ''),
          agencyName: String(item.agencyName || ''),
          ...(contactListId ? { contactListId } : {}),
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
