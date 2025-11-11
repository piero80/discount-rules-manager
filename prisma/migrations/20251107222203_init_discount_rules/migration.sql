-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'exclude',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExcludedCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "ruleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExcludedCollection_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DiscountRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ruleId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DiscountRule_shop_idx" ON "DiscountRule"("shop");

-- CreateIndex
CREATE INDEX "DiscountRule_shop_active_idx" ON "DiscountRule"("shop", "active");

-- CreateIndex
CREATE INDEX "ExcludedCollection_ruleId_idx" ON "ExcludedCollection"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedCollection_ruleId_collectionId_key" ON "ExcludedCollection"("ruleId", "collectionId");

-- CreateIndex
CREATE INDEX "RuleLog_shop_idx" ON "RuleLog"("shop");

-- CreateIndex
CREATE INDEX "RuleLog_createdAt_idx" ON "RuleLog"("createdAt");
