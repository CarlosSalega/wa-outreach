-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "waAccountStartDate" DATETIME NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "sendWindowStart" INTEGER NOT NULL DEFAULT 9,
    "sendWindowStartMin" INTEGER NOT NULL DEFAULT 0,
    "sendWindowEnd" INTEGER NOT NULL DEFAULT 19,
    "sendWindowEndMin" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIGURED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContactList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContactList_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pauseReason" TEXT,
    "templateId" TEXT NOT NULL,
    "whatsappAccountId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "delayMinSec" INTEGER NOT NULL DEFAULT 30,
    "delayMaxSec" INTEGER NOT NULL DEFAULT 45,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Campaign_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("createdAt", "delayMaxSec", "delayMinSec", "id", "name", "pauseReason", "status", "templateId", "updatedAt") SELECT "createdAt", "delayMaxSec", "delayMinSec", "id", "name", "pauseReason", "status", "templateId", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE INDEX "Campaign_status_order_idx" ON "Campaign"("status", "order");
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "campaignId" TEXT,
    "contactListId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contact_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "ContactList" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("agencyName", "campaignId", "createdAt", "id", "phone", "status") SELECT "agencyName", "campaignId", "createdAt", "id", "phone", "status" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ContactList_campaignId_key" ON "ContactList"("campaignId");

-- CreateIndex
CREATE INDEX "MessageQueue_status_campaignId_idx" ON "MessageQueue"("status", "campaignId");
