-- Migration to update plan structure for App Store publication
-- Update existing FREE plan subscriptions to use new max rules limit
UPDATE "Subscription" 
SET "maxRules" = 1 
WHERE "planName" = 'FREE' AND "maxRules" = 2;

-- Update any existing BASIC plan subscriptions to STARTER
UPDATE "Subscription"
SET "planName" = 'STARTER', "maxRules" = 5
WHERE "planName" = 'BASIC';

-- Update any existing PRO plan subscriptions to PROFESSIONAL  
UPDATE "Subscription"
SET "planName" = 'PROFESSIONAL', "maxRules" = 25
WHERE "planName" = 'PRO';

-- Convert all plan names from uppercase to lowercase for Partner Dashboard compatibility
UPDATE "Subscription" SET "planName" = 'free' WHERE "planName" = 'FREE';
UPDATE "Subscription" SET "planName" = 'starter' WHERE "planName" = 'STARTER';  
UPDATE "Subscription" SET "planName" = 'professional' WHERE "planName" = 'PROFESSIONAL';
UPDATE "Subscription" SET "planName" = 'enterprise' WHERE "planName" = 'ENTERPRISE';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "Subscription_planName_idx" ON "Subscription"("planName");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");