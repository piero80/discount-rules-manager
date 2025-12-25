-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'exclude',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcludedCollection" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "ruleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcludedCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ruleId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscountRule_shop_active_idx" ON "DiscountRule"("shop", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountRule_shop_key" ON "DiscountRule"("shop");

-- CreateIndex
CREATE INDEX "ExcludedCollection_ruleId_idx" ON "ExcludedCollection"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedCollection_ruleId_collectionId_key" ON "ExcludedCollection"("ruleId", "collectionId");

-- CreateIndex
CREATE INDEX "RuleLog_shop_idx" ON "RuleLog"("shop");

-- CreateIndex
CREATE INDEX "RuleLog_createdAt_idx" ON "RuleLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ExcludedCollection" ADD CONSTRAINT "ExcludedCollection_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DiscountRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
