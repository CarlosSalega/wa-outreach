import { PrismaClient } from '@prisma/client';

/**
 * Seed script for multi-account migration.
 * 1. Reads existing AppConfig → creates default WhatsAppAccount
 * 2. For each existing Campaign: sets whatsappAccountId, order = 0
 * 3. Creates ContactList(name: campaign.name, campaignId) per campaign
 * 4. Backfills Contact.contactListId for contacts already assigned to campaigns
 *
 * This is additive-first: AppConfig warmup fields remain (not removed yet).
 */
export async function seedMultiAccount(prisma: PrismaClient) {
  // Step 1: Read existing AppConfig for warmup settings
  const appConfig = await prisma.appConfig.findFirst();

  const accountDefaults = {
    name: 'Default Account',
    waAccountStartDate: appConfig?.waAccountStartDate ?? new Date(),
    dailyLimit: appConfig?.dailyLimit ?? 50,
    sendWindowStart: appConfig?.sendWindowStart ?? 9,
    sendWindowStartMin: appConfig?.sendWindowStartMin ?? 0,
    sendWindowEnd: appConfig?.sendWindowEnd ?? 19,
    sendWindowEndMin: appConfig?.sendWindowEndMin ?? 0,
    status: 'CONFIGURED' as const,
  };

  // Step 1: Create default WhatsAppAccount
  const account = await prisma.whatsAppAccount.create({
    data: accountDefaults,
  });
  console.log(`[seed] Created WhatsAppAccount "${account.name}" (${account.id})`);

  // Step 2: Backfill existing campaigns
  const campaigns = await prisma.campaign.findMany();

  for (const campaign of campaigns) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        whatsappAccountId: account.id,
        order: 0,
      },
    });
  }
  const campaignsUpdated = campaigns.length;
  console.log(`[seed] Updated ${campaignsUpdated} campaigns`);

  // Step 3: Create ContactList per campaign
  let listsCreated = 0;
  let contactsBackfilled = 0;

  for (const campaign of campaigns) {
    const list = await prisma.contactList.create({
      data: {
        name: campaign.name,
        campaignId: campaign.id,
      },
    });
    listsCreated++;
    console.log(`[seed] Created ContactList "${list.name}" for campaign ${campaign.id}`);

    // Step 4: Backfill contacts already assigned to this campaign
    const result = await prisma.contact.updateMany({
      where: { campaignId: campaign.id },
      data: { contactListId: list.id },
    });
    contactsBackfilled += result.count;
  }

  console.log(
    `[seed] Done — ${listsCreated} lists, ${contactsBackfilled} contacts backfilled`
  );

  return {
    accountId: account.id,
    campaignsUpdated,
    listsCreated,
    contactsBackfilled,
  };
}

// Allow running directly: tsx prisma/seed.ts
async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const result = await seedMultiAccount(prisma);
    console.log('Seed result:', result);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

// ESM-compatible check for direct execution
const isMainModule =
  process.argv[1]?.endsWith('seed.ts') ||
  process.argv[1]?.endsWith('seed.js');

if (isMainModule) {
  main();
}
