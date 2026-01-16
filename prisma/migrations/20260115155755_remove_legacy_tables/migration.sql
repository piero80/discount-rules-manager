/*
  Warnings:

  - You are about to drop the `DiscountRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExcludedCollection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShopSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExcludedCollection" DROP CONSTRAINT "ExcludedCollection_ruleId_fkey";

-- DropTable
DROP TABLE "DiscountRule";

-- DropTable
DROP TABLE "ExcludedCollection";

-- DropTable
DROP TABLE "ShopSettings";
