# 🧪 END-TO-END TEST PLAN

## Discount Rules Manager - Complete Workflow Testing

### **PRE-REQUISITI**

- ✅ Server di sviluppo attivo (`shopify app dev`)
- ✅ App installata su demo-app-list.myshopify.com
- ✅ Database Prisma funzionante
- ✅ Esistono almeno 2 discount attivi (TEST10, TEST20)
- ✅ Esistono almeno 3 collection (Home page, Winter collection, Red Collection)

---

## **TEST SCENARIO 1: DASHBOARD VERIFICATION**

### Obiettivo: Verificare che la dashboard carichi i dati in tempo reale

**Test Steps:**

1. [ ] Navigare alla homepage dell'app
2. [ ] Verificare che il dashboard mostri:
   - [ ] Numero corretto di discounts attivi (2)
   - [ ] Numero corretto di collections (3)
   - [ ] Numero di regole attive (dovrebbe essere 0 inizialmente)
   - [ ] Last activity con formato tempo corretto
3. [ ] Verificare che i dati si aggiornino automaticamente
4. [ ] Controllare che non ci siano errori nella console browser

**Expected Results:**

- Dashboard carica entro 3 secondi
- Tutti i numeri corrispondono ai dati effettivi in Shopify
- UI responsive e professionale
- Nessun errore JavaScript

---

## **TEST SCENARIO 2: CREATE EXCLUSION RULE**

### Obiettivo: Creare una regola di esclusione e verificare il salvataggio

**Test Steps:**

1. [ ] Navigare alla pagina "Manage Rules"
2. [ ] Selezionare "Exclude Collections" mode
3. [ ] Selezionare 1-2 collections da escludere (es: "Winter collection")
4. [ ] Cliccare "Save Rules"
5. [ ] Verificare messaggio di successo
6. [ ] Verificare che la regola appaia nella dashboard
7. [ ] Controllare il database che la regola sia salvata

**Expected Results:**

- Form funziona correttamente
- Salvataggio completato senza errori
- Regola visibile nella dashboard
- Database aggiornato correttamente

---

## **TEST SCENARIO 3: APPLY RULE TO DISCOUNTS**

### Obiettivo: Applicare la regola ai discount esistenti

**Test Steps:**

1. [ ] Dalla pagina rules, testare l'applicazione della regola
2. [ ] Verificare che i discount vengano modificati correttamente
3. [ ] Controllare che le collection escluse non siano più nei discount
4. [ ] Verificare che le altre collection rimangano invariate

**Expected Results:**

- Regola applicata con successo a tutti i discount
- Collection escluse rimosse dai discount target
- Altre collection non toccate
- Nessun errore durante l'applicazione

---

## **TEST SCENARIO 4: SHOPIFY ADMIN VERIFICATION**

### Obiettivo: Verificare nell'admin Shopify che le modifiche siano effettive

**Test Steps:**

1. [ ] Accedere a demo-app-list.myshopify.com/admin
2. [ ] Navigare a Settings > Discounts
3. [ ] Aprire il discount "TEST10"
4. [ ] Verificare che le collection escluse non siano più presenti
5. [ ] Ripetere per "TEST20"
6. [ ] Verificare che gli altri parametri del discount siano invariati

**Expected Results:**

- Collection escluse effettivamente rimosse dai discount
- Discount ancora attivi e funzionanti
- Modifiche persistenti dopo refresh

---

## **TEST SCENARIO 5: INCLUDE MODE TESTING**

### Obiettivo: Testare anche la modalità "include only"

**Test Steps:**

1. [ ] Cambiare mode a "Include Collections"
2. [ ] Selezionare solo 1 collection da includere (es: "Home page")
3. [ ] Salvare la regola
4. [ ] Applicare ai discount
5. [ ] Verificare che solo la collection selezionata rimanga nei discount

**Expected Results:**

- Solo collection incluse rimangono nei discount target
- Tutte le altre collection rimosse
- Comportamento opposto rispetto a exclude mode

---

## **TEST SCENARIO 6: ERROR HANDLING**

### Obiettivo: Verificare gestione errori e casi limite

**Test Steps:**

1. [ ] Tentare di salvare senza selezionare collection
2. [ ] Testare con network disconnesso
3. [ ] Verificare comportamento con discount non esistenti
4. [ ] Testare rollback in caso di errore parziale

**Expected Results:**

- Errori gestiti gracefully
- Messaggi informativi per l'utente
- Stato consistente anche in caso di errore
- Nessun crash dell'applicazione

---

## **TEST SCENARIO 7: PERFORMANCE & UX**

### Obiettivo: Verificare performance e user experience

**Test Steps:**

1. [ ] Misurare tempo di caricamento pagine
2. [ ] Testare responsiveness su mobile/tablet
3. [ ] Verificare accessibilità (contrasti, focus, etc.)
4. [ ] Testare con molte collection (se disponibili)

**Expected Results:**

- Pagine caricano entro 3 secondi
- UI responsive su tutti i dispositivi
- Buona accessibilità
- Performance accettabili anche con molti dati

---

## **COMPLETION CRITERIA**

Per considerare il test E2E completato con successo:

- [ ] Tutti i 7 scenari completati senza errori critici
- [ ] Dashboard funziona correttamente
- [ ] Creazione e applicazione regole funziona
- [ ] Modifiche persistenti in Shopify admin
- [ ] Error handling adeguato
- [ ] Performance accettabili
- [ ] UI professionale e user-friendly

---

## **RISULTATI TEST**

_Compilazione in tempo reale durante l'esecuzione dei test_

### **TEST SCENARIO 1: DASHBOARD VERIFICATION** ✅ IN PROGRESS

**Status:** Testing started at 15:37
**Steps Completed:**

- ✅ Server di sviluppo avviato correttamente
- ✅ Environment variables caricate
- ✅ Access scopes garantiti: read_discounts, write_discounts, etc.
- ✅ Cloudflare tunnel attivo: palmer-went-kent-apt.trycloudflare.com
- ✅ App preview URL available: demo-app-list.myshopify.com
- 🔄 **CURRENT:** Testing dashboard load and data display

**PASSED:** 0/7 scenarios  
**FAILED:** 0/7 scenarios  
**IN PROGRESS:** 1/7 scenarios (Dashboard Verification)
**CRITICAL ISSUES:** None  
**MINOR ISSUES:** None

**READY FOR PRODUCTION:** ❌ Testing in progress
