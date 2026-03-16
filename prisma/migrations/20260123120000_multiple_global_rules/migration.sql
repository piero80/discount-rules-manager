-- AddMultipleRulesFields
-- Aggiunge campi per multiple global rules mantenendo temporaneamente il constraint unique

-- Aggiungi nuovi campi alla tabella DiscountRule
ALTER TABLE "DiscountRule" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Rule';
ALTER TABLE "DiscountRule" ADD COLUMN "description" TEXT;
ALTER TABLE "DiscountRule" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DiscountRule" ADD COLUMN "scheduledStart" TIMESTAMP(3);
ALTER TABLE "DiscountRule" ADD COLUMN "scheduledEnd" TIMESTAMP(3);
ALTER TABLE "DiscountRule" ADD COLUMN "isScheduled" BOOLEAN NOT NULL DEFAULT false;

-- Aggiungi nuovi indici per performance
CREATE INDEX "DiscountRule_shop_priority_idx" ON "DiscountRule"("shop", "priority");
CREATE INDEX "DiscountRule_scheduledStart_scheduledEnd_idx" ON "DiscountRule"("scheduledStart", "scheduledEnd");

-- Aggiorna le regole esistenti per avere priorità 0 (highest priority)
UPDATE "DiscountRule" SET "priority" = 0 WHERE "priority" IS NULL;

-- Nota: Il constraint unique su shop viene rimosso in una migration successiva
-- per permettere multiple rules per shop