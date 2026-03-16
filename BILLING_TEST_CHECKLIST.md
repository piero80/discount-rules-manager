# 🧪 Billing Test Checklist

## Pre-Test Setup ✅

- [ ] App running locally (`npm run dev`)
- [ ] Development store accessible
- [ ] Database connection working

## Basic Flow Testing 🔄

### 1. Free Plan Test

- [ ] Navigate to `/app/billing`
- [ ] Verify shows "FREE Plan"
- [ ] Check max rules = 2
- [ ] Try creating 3+ rules (should block)

### 2. Upgrade Flow Test

- [ ] Click "Upgrade to Basic"
- [ ] Gets redirected to Shopify billing page
- [ ] Shows "TEST MODE" banner
- [ ] Accept fake subscription
- [ ] Redirected back to `/app/billing/callback`
- [ ] Verify success message
- [ ] Check database: `planName = 'BASIC'`
- [ ] Verify max rules = 10

### 3. Features Test

- [ ] Create 10 rules (should work)
- [ ] Try creating 11th rule (should block)
- [ ] Test scheduler features (Basic+ only)

### 4. Cancel Flow Test

- [ ] Navigate to `/app/billing`
- [ ] Click "Cancel Subscription"
- [ ] Verify downgrade to FREE
- [ ] Check database: `planName = 'FREE'`

## Error Testing 🚨

- [ ] Test with invalid callback URLs
- [ ] Test network failures (disconnect)
- [ ] Test database errors

## Console Logs to Check 📋

```js
// Look for these in browser console:
"🔄 Starting billing process for plan: BASIC";
"✅ Authentication successful for shop: ...";
"📊 GraphQL response: ...";
"✅ App subscription created: ...";
"✅ Subscription activated and database updated";
```

## Database Verification 💾

```sql
-- Check subscription table:
SELECT * FROM Subscription ORDER BY updatedAt DESC LIMIT 5;

-- Check plan limits:
SELECT shop, planName, maxRules, shopifyChargeId FROM Subscription;
```

## Expected Results ✨

- ✅ Smooth redirect flow
- ✅ Database updates correctly
- ✅ Plan limits enforced
- ✅ No real charges in test mode
- ✅ All error handling works
