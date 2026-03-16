-- DropIndex
DROP INDEX "Subscription_planName_idx";

-- DropIndex
DROP INDEX "Subscription_status_idx";

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "maxRules" SET DEFAULT 1;
