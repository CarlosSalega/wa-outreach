-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waAccountStartDate" DATETIME NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 50,
    "sendWindowStart" INTEGER NOT NULL DEFAULT 9,
    "sendWindowEnd" INTEGER NOT NULL DEFAULT 19,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppConfig" ("createdAt", "dailyLimit", "id", "updatedAt", "waAccountStartDate") SELECT "createdAt", "dailyLimit", "id", "updatedAt", "waAccountStartDate" FROM "AppConfig";
DROP TABLE "AppConfig";
ALTER TABLE "new_AppConfig" RENAME TO "AppConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
