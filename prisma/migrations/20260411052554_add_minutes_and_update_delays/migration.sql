-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waAccountStartDate" DATETIME NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "sendWindowStart" INTEGER NOT NULL DEFAULT 9,
    "sendWindowStartMin" INTEGER NOT NULL DEFAULT 0,
    "sendWindowEnd" INTEGER NOT NULL DEFAULT 19,
    "sendWindowEndMin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppConfig" ("createdAt", "dailyLimit", "id", "sendWindowEnd", "sendWindowStart", "updatedAt", "waAccountStartDate") SELECT "createdAt", "dailyLimit", "id", "sendWindowEnd", "sendWindowStart", "updatedAt", "waAccountStartDate" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pauseReason" TEXT,
    "templateId" TEXT NOT NULL,
    "delayMinSec" INTEGER NOT NULL DEFAULT 30,
    "delayMaxSec" INTEGER NOT NULL DEFAULT 45,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("createdAt", "delayMaxSec", "delayMinSec", "id", "name", "pauseReason", "status", "templateId", "updatedAt") SELECT "createdAt", "delayMaxSec", "delayMinSec", "id", "name", "pauseReason", "status", "templateId", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
