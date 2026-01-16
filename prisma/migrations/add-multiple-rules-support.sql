-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'legacy',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountSpecificRule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "discountTitle" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'exclude',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountSpecificRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecificExcludedCollection" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "ruleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecificExcludedCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecificExcludedProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecificExcludedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "ShopSettings_shop_idx" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "DiscountSpecificRule_shop_active_idx" ON "DiscountSpecificRule"("shop", "active");

-- CreateIndex
CREATE INDEX "DiscountSpecificRule_discountId_idx" ON "DiscountSpecificRule"("discountId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountSpecificRule_shop_discountId_key" ON "DiscountSpecificRule"("shop", "discountId");

-- CreateIndex
CREATE INDEX "SpecificExcludedCollection_ruleId_idx" ON "SpecificExcludedCollection"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecificExcludedCollection_ruleId_collectionId_key" ON "SpecificExcludedCollection"("ruleId", "collectionId");

-- CreateIndex
CREATE INDEX "SpecificExcludedProduct_ruleId_idx" ON "SpecificExcludedProduct"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecificExcludedProduct_ruleId_productId_key" ON "SpecificExcludedProduct"("ruleId", "productId");

-- AddForeignKey
ALTER TABLE "SpecificExcludedCollection" ADD CONSTRAINT "SpecificExcludedCollection_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DiscountSpecificRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecificExcludedProduct" ADD CONSTRAINT "SpecificExcludedProduct_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DiscountSpecificRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;