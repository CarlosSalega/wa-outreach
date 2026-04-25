import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { interpolate } from '@/lib/whatsapp/interpolate';

export async function GET() {
  const campaign = await prisma.campaign.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      template: true,
      _count: { select: { queue: true } },
    },
  });
  return NextResponse.json(campaign);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, templateId, delayMinSec, delayMaxSec } = body;

  const campaign = await prisma.campaign.create({
    data: {
      name,
      templateId,
      delayMinSec: delayMinSec ?? 45,
      delayMaxSec: delayMaxSec ?? 120,
    },
    include: { template: true },
  });

  const contacts = await prisma.contact.findMany({
    where: { campaignId: null, status: 'pending' },
  });

  if (!contacts.length) {
    return NextResponse.json(
      { error: 'No hay contactos pendientes para encolar' },
      { status: 400 }
    );
  }

  const messages = JSON.parse(campaign.template.messages) as { order: number; body: string }[];

  let scheduledAt = new Date();
  const queueItems = [];

  for (const contact of contacts) {
    const variables = { nombre: contact.agencyName || '', telefono: contact.phone };

    for (const msg of messages) {
      queueItems.push({
        contactId: contact.id,
        campaignId: campaign.id,
        messageOrder: msg.order,
        bodySnapshot: interpolate(msg.body, variables),
        scheduledAt: new Date(scheduledAt),
      });

      const intraDelay =
        Math.floor(Math.random() * (delayMaxSec - delayMinSec + 1) + delayMinSec) * 1000;
      scheduledAt = new Date(scheduledAt.getTime() + intraDelay);
    }

    // Delay entre contactos: 3-7 minutos (promedio 5 min)
    const interDelay = Math.floor(Math.random() * (7 - 3 + 1) + 3) * 60 * 1000;
    scheduledAt = new Date(scheduledAt.getTime() + interDelay);

    await prisma.contact.update({
      where: { id: contact.id },
      data: { campaignId: campaign.id, status: 'active' },
    });
  }

  await prisma.messageQueue.createMany({ data: queueItems });

  return NextResponse.json({
    campaign,
    contactsEnqueued: contacts.length,
    messagesScheduled: queueItems.length,
  });
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  const campaign = await prisma.campaign.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    // Delete all messageLogs first (they reference messageQueue)
    const allQueueItems = await prisma.messageQueue.findMany({
      where: { campaignId: id },
      select: { id: true },
    });

    if (allQueueItems.length > 0) {
      await prisma.messageLog.deleteMany({
        where: { messageQueueId: { in: allQueueItems.map(q => q.id) } },
      });
    }

    // Delete all messageQueue items
    await prisma.messageQueue.deleteMany({ where: { campaignId: id } });

    // Reset contacts
    await prisma.contact.updateMany({
      where: { campaignId: id },
      data: { campaignId: null, status: 'pending' },
    });

    // Delete campaign
    await prisma.campaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    return NextResponse.json(
      { error: 'Error al eliminar la campaña' },
      { status: 500 }
    );
  }
}
