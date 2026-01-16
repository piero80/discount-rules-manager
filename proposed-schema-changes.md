# Proposta Modifiche Database Schema

## Schema Attuale (Problemi)

```prisma
model DiscountRule {
  id        String   @id @default(cuid())
  shop      String
  // ❌ Una sola regola per shop - troppo limitante
  @@unique([shop])
}
```

## Schema Proposto (Soluzione)

```prisma
model DiscountRule {
  id            String   @id @default(cuid())
  shop          String
  discountId    String   // Shopify discount ID/GID
  discountTitle String   // Cache del titolo per UI
  discountType  String   // "DiscountCodeBasic", "DiscountAutomaticBasic", etc.
  mode          String   @default("exclude") // "exclude" o "include"
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  excludedCollections ExcludedCollection[]
  excludedProducts    ExcludedProduct[]     // Nuova feature per prodotti singoli

  // ✅ Una regola per discount per shop - molto più flessibile
  @@unique([shop, discountId])
  @@index([shop, active])
  @@index([discountId])
}

model ExcludedProduct {
  id        String @id @default(cuid())
  productId String // Shopify product GID
  title     String

  ruleId    String
  rule      DiscountRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([ruleId, productId])
}
```

## Vantaggi del Nuovo Schema

### 1. **Granularità per Discount**

- Ogni discount può avere la sua regola specifica
- Alcuni discount possono escludere Collection A, altri Collection B
- Flessibilità totale nella gestione

### 2. **Supporto Prodotti + Collections**

- Non solo collections ma anche singoli prodotti
- UX più ricca: "Escludi questa collezione E questi 3 prodotti specifici"

### 3. **Performance & Scalabilità**

- Indici ottimizzati per query frequenti
- Queries più mirate: `WHERE shop = ? AND discountId = ?`

## Flusso UX Proposto

### Pagina Principale: Lista Discounts

```
┌─────────────────────────────────────────┐
│ I Tuoi Discounts                        │
├─────────────────────────────────────────┤
│ 🔥 Summer Sale (-20%)          [Configura Regole] │
│    ↳ 2 collections escluse              │
│                                         │
│ 🎯 VIP Discount (-15%)         [Configura Regole] │
│    ↳ Nessuna esclusione                 │
│                                         │
│ ⚡ Flash Sale (-30%)           [Configura Regole] │
│    ↳ 1 collection, 3 prodotti esclusi   │
└─────────────────────────────────────────┘
```

### Pagina Config per Singolo Discount

```
┌─────────────────────────────────────────┐
│ Configura Esclusioni: Summer Sale       │
├─────────────────────────────────────────┤
│                                         │
│ 📦 Collections Escluse:                 │
│ • Luxury Items          [Remove]        │
│ • Sale Items           [Remove]         │
│ [+ Aggiungi Collection]                 │
│                                         │
│ 🛍️ Prodotti Esclusi:                    │
│ • iPhone 15 Pro        [Remove]         │
│ • MacBook Air          [Remove]         │
│ [+ Aggiungi Prodotto]                   │
│                                         │
│ [💾 Salva Regole]  [🔙 Torna ai Discounts] │
└─────────────────────────────────────────┘
```

## Considerazioni Tecniche

### Migrazione Database

- ✅ Possibile migrare dati esistenti
- La regola globale attuale può essere replicata per ogni discount

### Performance

- ✅ Query più efficienti (indici specifici)
- ✅ Meno dati trasferiti (solo regole del discount specifico)

### Compatibilità Shopify

- ✅ Ogni discount mantiene le sue GraphQL mutations separate
- ✅ Nessun conflitto tra regole di discount diversi

## Complessità di Implementazione

- **Medium**: Richiede refactor dell'UI e della logica
- **Migration**: Una migrazione Prisma + script di conversione dati
- **Testing**: Test più complessi ma più specifici
