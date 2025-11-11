/*
  Warnings:

  - A unique constraint covering the columns `[shop,active]` on the table `DiscountRule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DiscountRule_shop_active_key" ON "DiscountRule"("shop", "active");
