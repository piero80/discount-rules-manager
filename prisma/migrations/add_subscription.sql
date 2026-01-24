-- Add subscription management to existing schema

CREATE TABLE "Subscription" (
  "id" TEXT PRIMARY KEY,
  "shop" TEXT NOT NULL UNIQUE,
  "planName" TEXT NOT NULL DEFAULT 'FREE', -- 'FREE', 'BASIC', 'PRO'
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CANCELED', 'TRIAL'
  "maxRules" INTEGER NOT NULL DEFAULT 2,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "shopifyChargeId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast shop lookups
CREATE INDEX "Subscription_shop_idx" ON "Subscription"("shop");