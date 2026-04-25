import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const { name, messages } = await req.json();

  if (!name || !messages?.length) {
    return NextResponse.json(
      { error: 'Nombre y mensajes son requeridos' },
      { status: 400 }
    );
  }

  const template = await prisma.template.create({
    data: { name, messages: JSON.stringify(messages) },
  });

  return NextResponse.json(template);
}

export async function PUT(req: NextRequest) {
  const { id, name, messages } = await req.json();

  const template = await prisma.template.update({
    where: { id },
    data: { name, messages: JSON.stringify(messages) },
  });

  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    // Delete all campaigns referencing this template (and their queues/logs)
    const campaigns = await prisma.campaign.findMany({
      where: { templateId: id },
      select: { id: true },
    });

    for (const camp of campaigns) {
      const queueItems = await prisma.messageQueue.findMany({
        where: { campaignId: camp.id },
        select: { id: true },
      });
      if (queueItems.length > 0) {
        await prisma.messageLog.deleteMany({
          where: { messageQueueId: { in: queueItems.map(q => q.id) } },
        });
      }
      await prisma.messageQueue.deleteMany({ where: { campaignId: camp.id } });
      await prisma.contact.updateMany({
        where: { campaignId: camp.id },
        data: { campaignId: null, status: 'pending' },
      });
    }

    await prisma.campaign.deleteMany({ where: { templateId: id } });
    await prisma.template.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    return NextResponse.json(
      { error: 'Error al eliminar el template' },
      { status: 500 }
    );
  }
}
