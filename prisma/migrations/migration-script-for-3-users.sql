-- ============================================
-- MIGRATION SCRIPT: Legacy to Multiple Rules
-- Per i 3 utenti esistenti
-- ============================================

-- Step 1: Identifico i dati esistenti
-- Verifica cosa abbiamo nel database legacy
SELECT 
  dr.shop,
  dr.mode,
  dr.active,
  COUNT(ec.id) as excluded_collections_count
FROM "DiscountRule" dr
LEFT JOIN "ExcludedCollection" ec ON dr.id = ec."ruleId"
GROUP BY dr.shop, dr.mode, dr.active;

-- Step 2: Ottengo la lista dei discount per ogni shop
-- (Questo va fatto via API Shopify durante la migrazione)
-- Placeholder per la logica che deve essere implementata in TypeScript

-- Step 3: MIGRAZIONE AUTOMATICA
-- Per ogni shop con regole legacy, crea regole multiple

-- 3a. Crea ShopSettings per tutti i shop esistenti
INSERT INTO "ShopSettings" (id, shop, mode, version, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid() as id,
  shop,
  'multiple' as mode,
  '2.0' as version,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "DiscountRule"
ON CONFLICT (shop) DO UPDATE SET
  mode = 'multiple',
  version = '2.0',
  "updatedAt" = NOW();

-- 3b. Per ogni discount di ogni shop, crea una DiscountSpecificRule
-- (Questo script deve essere eseguito PER OGNI DISCOUNT trovato via API)
/*
Esempio per uno shop con 3 discount:

INSERT INTO "DiscountSpecificRule" (
  id, shop, "discountId", "discountTitle", "discountType", 
  mode, active, "createdAt", "updatedAt"
) VALUES 
  (gen_random_uuid(), 'shop1.myshopify.com', 'gid://shopify/DiscountNode/1', 'Summer Sale', 'DiscountCodeBasic', 'exclude', true, NOW(), NOW()),
  (gen_random_uuid(), 'shop1.myshopify.com', 'gid://shopify/DiscountNode/2', 'VIP Discount', 'DiscountAutomaticBasic', 'exclude', true, NOW(), NOW()),
  (gen_random_uuid(), 'shop1.myshopify.com', 'gid://shopify/DiscountNode/3', 'Flash Sale', 'DiscountCodeBasic', 'exclude', true, NOW(), NOW());
*/

-- 3c. Per ogni DiscountSpecificRule creata, replica le ExcludedCollection
-- Trova tutte le collections escluse dal rule legacy
WITH legacy_rules AS (
  SELECT dr.id as legacy_rule_id, dr.shop, dr.mode
  FROM "DiscountRule" dr
  WHERE dr.active = true
),
new_rules AS (
  SELECT dsr.id as new_rule_id, dsr.shop, dsr."discountId"
  FROM "DiscountSpecificRule" dsr
)
INSERT INTO "SpecificExcludedCollection" (
  id, "collectionId", title, "productsCount", "ruleId", "createdAt"
)
SELECT 
  gen_random_uuid() as id,
  ec."collectionId",
  ec.title,
  ec."productsCount",
  nr.new_rule_id,
  NOW() as "createdAt"
FROM legacy_rules lr
JOIN "ExcludedCollection" ec ON lr.legacy_rule_id = ec."ruleId"
JOIN new_rules nr ON lr.shop = nr.shop;

-- Step 4: VERIFICA MIGRAZIONE
-- Conta i dati migrati per assicurarsi che tutto sia corretto

-- 4a. Verifica ShopSettings
SELECT shop, mode, version FROM "ShopSettings" ORDER BY shop;

-- 4b. Verifica DiscountSpecificRule
SELECT 
  shop, 
  COUNT(*) as rules_count,
  COUNT(DISTINCT "discountId") as unique_discounts
FROM "DiscountSpecificRule" 
GROUP BY shop 
ORDER BY shop;

-- 4c. Verifica SpecificExcludedCollection
SELECT 
  dsr.shop,
  COUNT(sec.id) as excluded_collections_count
FROM "DiscountSpecificRule" dsr
LEFT JOIN "SpecificExcludedCollection" sec ON dsr.id = sec."ruleId"
GROUP BY dsr.shop
ORDER BY dsr.shop;

-- 4d. Confronto: Legacy vs New
SELECT 
  'Legacy' as source,
  dr.shop,
  COUNT(ec.id) as excluded_collections_count
FROM "DiscountRule" dr
LEFT JOIN "ExcludedCollection" ec ON dr.id = ec."ruleId"
GROUP BY dr.shop

UNION ALL

SELECT 
  'Multiple' as source,
  dsr.shop,
  COUNT(sec.id) as excluded_collections_count  
FROM "DiscountSpecificRule" dsr
LEFT JOIN "SpecificExcludedCollection" sec ON dsr.id = sec."ruleId"
GROUP BY dsr.shop

ORDER BY shop, source;

-- Step 5: CLEANUP (OPZIONALE - da fare dopo verifica)
-- Una volta verificato che tutto funziona, si possono rimuovere i dati legacy

/*
-- ATTENZIONE: Non eseguire finché non si è sicuri!
-- Rimuove le collections escluse legacy
DELETE FROM "ExcludedCollection";

-- Rimuove le regole legacy  
DELETE FROM "DiscountRule";

-- In futuro si potrebbero anche droppare le tabelle legacy:
-- DROP TABLE "ExcludedCollection";
-- DROP TABLE "DiscountRule";
*/