# 🌟 Come Identificare Clienti VIP - Guida Pratica

## Metodi di Identificazione VIP

### 1. 🏷️ **Metodo Tag (Più Semplice)**

**Quando usare**: Hai già una lista di clienti VIP identificati manualmente

```typescript
// Configurazione regola
{
  conditionType: "customer_tag",
  operator: "equals",
  value: "VIP"
}
```

**Come impostare i tag**:

- **Shopify Admin** → **Customers** → Seleziona cliente → **Tags** → Aggiungi "VIP"
- **Oppure in massa**: CSV import con colonna tags
- **Tag supportati**: VIP, vip, Premium, PREMIUM, Gold, Platinum

---

### 2. 💰 **Metodo Spesa Totale**

**Quando usare**: Clienti che hanno speso oltre una certa soglia

```typescript
// Esempio: Cliente che ha speso oltre €1000 = VIP
{
  conditionType: "customer_is_vip",
  operator: "is_true",
  value: {
    method: "spending",
    config: { threshold: 1000 }
  }
}
```

**Esempi di soglie per settore**:

- **Fashion**: €500-800
- **Electronics**: €1500-2500
- **Beauty/Cosmetics**: €300-500
- **B2B/Wholesale**: €5000+

---

### 3. 🛒 **Metodo Ordini Multipli**

**Quando usare**: Clienti fedeli con molti acquisti ripetuti

```typescript
// Esempio: Cliente con 8+ ordini = VIP
{
  conditionType: "customer_is_vip",
  operator: "is_true",
  value: {
    method: "orders",
    config: { minOrders: 8 }
  }
}
```

---

### 4. 🧠 **Metodo Combinato (Raccomandato)**

**Quando usare**: Identificazione intelligente che combina più fattori

```typescript
// Sistema automatico che considera:
// - Spesa totale ≥ €500
// - 5+ ordini
// - Cliente da 6+ mesi
// - Spesa media per ordine ≥ €75
{
  conditionType: "customer_is_vip",
  operator: "is_true",
  value: {
    method: "combined",
    config: {}
  }
}
```

---

### 5. 🎯 **Metodo VIP Score**

**Quando usare**: Vuoi una valutazione graduata (0-100 punti)

```typescript
// Esempio: VIP Score > 70 punti
{
  conditionType: "customer_vip_score",
  operator: "greater_than",
  value: 70
}
```

**Come viene calcolato il VIP Score**:

- **Spesa totale**: max 40 punti (1 punto ogni €50)
- **Numero ordini**: max 30 punti (3 punti per ordine)
- **Fedeltà**: max 20 punti (2 punti per mese di iscrizione)
- **Spesa media alta**: max 10 punti bonus

**Fasce VIP Score**:

- **80-100**: VIP Premium
- **60-79**: VIP Standard
- **40-59**: Cliente Prezioso
- **0-39**: Cliente Regular

---

## 🎯 Esempi di Regole VIP Complete

### Esempio 1: Sconto Weekend VIP

```typescript
{
  name: "Weekend VIP Special",
  conditions: [
    {
      conditionType: "customer_is_vip",
      operator: "is_true",
      value: { method: "combined", config: {} },
      logicOperator: "AND"
    },
    {
      conditionType: "day_of_week",
      operator: "in_list",
      value: ["Saturday", "Sunday"],
      logicOperator: "AND"
    },
    {
      conditionType: "cart_total",
      operator: "greater_than",
      value: 100,
      logicOperator: "AND"
    }
  ],
  actions: [
    {
      actionType: "percentage_discount",
      value: { percentage: 15 },
      maxAmount: 50
    },
    {
      actionType: "free_shipping",
      value: {}
    }
  ]
}
```

### Esempio 2: Sconto Basato su VIP Score

```typescript
{
  name: "Sconto Graduato VIP Score",
  conditions: [
    {
      conditionType: "customer_vip_score",
      operator: "greater_than",
      value: 70,
      logicOperator: "AND"
    }
  ],
  actions: [
    {
      actionType: "percentage_discount",
      value: { percentage: 12 },
      maxAmount: 30
    }
  ]
}
```

### Esempio 3: Alto Spender con Tag Backup

```typescript
{
  name: "High Spender o VIP Tag",
  conditions: [
    {
      conditionType: "customer_total_spent",
      operator: "greater_than",
      value: 1000,
      logicOperator: "OR"  // Nota: OR invece di AND
    },
    {
      conditionType: "customer_tag",
      operator: "equals",
      value: "VIP",
      logicOperator: "OR"
    }
  ]
}
```

---

## 🔧 Setup Pratico Step-by-Step

### Per E-commerce Fashion

1. **Crea regola VIP base**:

   ```
   customer_total_spent > €500 OR customer_tag = "VIP"
   ```

2. **Aggiungi condizione stagionale**:

   ```
   + day_of_week IN ["Friday", "Saturday"]
   ```

3. **Imposta sconto attraente**:
   ```
   20% discount + free shipping (max €40)
   ```

### Per B2B/Wholesale

1. **Usa tag specifici**:

   ```
   customer_tag IN ["Wholesale", "B2B", "Reseller"]
   ```

2. **Soglie più alte**:

   ```
   customer_total_spent > €5000
   ```

3. **Sconti maggiori**:
   ```
   25% discount (max €200)
   ```

---

## 🚀 Migrazione da Sistema Esistente

### Se hai già clienti VIP identificati:

1. **Esporta lista clienti VIP** da Shopify
2. **Aggiungi tag "VIP"** in massa tramite CSV
3. **Crea prima regola semplice** con `customer_tag = "VIP"`
4. **Testa la regola** con clienti conosciuti
5. **Aggiungi gradualmente** logica più complessa

### Per identificazione automatica:

1. **Analizza i tuoi dati**:
   - Qual è la spesa media dei tuoi migliori clienti?
   - Quanti ordini fanno in media?
2. **Imposta soglie realistic**:
   - Parti con soglie che catturano il 10-20% dei clienti
   - Monitora le performance
   - Aggiusta di conseguenza

3. **Usa il metodo combinato**:
   - Inizia con `customer_is_vip: combined`
   - È già ottimizzato per la maggior parte dei business

---

## ⚡ Quick Start: Prima Regola VIP

**Regola più semplice da implementare subito**:

```typescript
{
  name: "Primo Sconto VIP",
  conditions: [
    {
      conditionType: "customer_is_vip",
      operator: "is_true",
      value: { method: "combined", config: {} }
    }
  ],
  actions: [
    {
      actionType: "percentage_discount",
      value: { percentage: 10 }
    }
  ]
}
```

**Risultato**: Tutti i clienti che il sistema considera VIP (spesa €500+, 5+ ordini, cliente da 6+ mesi) ottengono automaticamente il 10% di sconto.

🎯 **Inizia con questa regola, poi espandi man mano che vedi i risultati!**
