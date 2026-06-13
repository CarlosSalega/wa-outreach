import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { interpolate } from '@/lib/whatsapp/interpolate';

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      template: true,
      whatsappAccount: true,
      contactList: true,
      _count: { select: { queue: true } },
    },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, templateId, delayMinSec, delayMaxSec, whatsappAccountId, contactListId, order } = body;

  if (!name || !templateId) {
    return NextResponse.json(
      { error: 'name and templateId are required' },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      templateId,
      delayMinSec: delayMinSec ?? 45,
      delayMaxSec: delayMaxSec ?? 120,
      whatsappAccountId: whatsappAccountId ?? undefined,
      order: order ?? 0,
    },
    include: { template: true },
  });

  // If a contactListId is provided, link contacts from that list
  // Otherwise, find unassigned contacts (backward compatible)
  const contactWhere = contactListId
    ? { contactListId, status: 'pending' as const }
    : { campaignId: null, status: 'pending' as const };

  const contacts = await prisma.contact.findMany({
    where: contactWhere,
  });

  if (!contacts.length) {
    return NextResponse.json({
      campaign,
      contactsEnqueued: 0,
      messagesScheduled: 0,
    });
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

    const contactUpdateData: Record<string, unknown> = {
      campaignId: campaign.id,
      status: 'active',
    };
    if (contactListId) {
      contactUpdateData.contactListId = contactListId;
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: contactUpdateData,
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
