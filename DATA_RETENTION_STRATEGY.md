# Data Retention Strategy

## Current Issue

When users uninstall the app, we only delete sessions but keep all other data (subscriptions, discount rules, logs) indefinitely.

## Recommended Solution: Soft Delete with Retention

### 1. Database Schema Updates

Add these fields to main models:

```sql
-- Add to Subscription model
uninstalledAt DateTime?
isUninstalled Boolean @default(false)

-- Add to DiscountRule model
uninstalledAt DateTime?
isUninstalled Boolean @default(false)
```

### 2. Webhook Implementation

Update `webhooks.app.uninstalled.tsx`:

```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const uninstallTimestamp = new Date();

  // Mark data as uninstalled instead of deleting
  await db.subscription.updateMany({
    where: { shop },
    data: {
      isUninstalled: true,
      uninstalledAt: uninstallTimestamp,
    },
  });

  await db.discountRule.updateMany({
    where: { shop },
    data: {
      isUninstalled: true,
      uninstalledAt: uninstallTimestamp,
    },
  });

  // Still delete sessions immediately for security
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
```

### 3. Cleanup Job

Create scheduled job to permanently delete old data:

```typescript
// services/cleanup.server.ts
export async function cleanupUninstalledData() {
  const retentionDays = 60; // Configure based on your policy
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Permanently delete old uninstalled data
  await db.subscription.deleteMany({
    where: {
      isUninstalled: true,
      uninstalledAt: {
        lt: cutoffDate,
      },
    },
  });

  await db.discountRule.deleteMany({
    where: {
      isUninstalled: true,
      uninstalledAt: {
        lt: cutoffDate,
      },
    },
  });
}
```

### 4. Reinstallation Handling

When user reinstalls, restore their data:

```typescript
// In installation logic
export async function handleReinstall(shop: string) {
  // Check for uninstalled data
  const uninstalledSubscription = await db.subscription.findFirst({
    where: {
      shop,
      isUninstalled: true,
      uninstalledAt: {
        gt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days
      },
    },
  });

  if (uninstalledSubscription) {
    // Restore the subscription
    await db.subscription.updateMany({
      where: { shop, isUninstalled: true },
      data: {
        isUninstalled: false,
        uninstalledAt: null,
      },
    });

    // Restore discount rules
    await db.discountRule.updateMany({
      where: { shop, isUninstalled: true },
      data: {
        isUninstalled: false,
        uninstalledAt: null,
      },
    });

    return "restored";
  }

  return "new";
}
```

## Alternative: Immediate Deletion

If you prefer immediate cleanup for privacy/compliance:

```typescript
// Hard delete approach - webhooks.app.uninstalled.tsx
await db.subscription.deleteMany({ where: { shop } });
await db.discountRule.deleteMany({ where: { shop } });
await db.session.deleteMany({ where: { shop } });
```

## Privacy Policy Update

Update your privacy policy to mention:

- Data retention period after uninstallation
- Automatic cleanup process
- User's right to request immediate deletion

## Recommended Retention Periods

- **30 days**: Minimum for good UX
- **60 days**: Balanced approach (recommended)
- **90 days**: Maximum for most use cases
- **Immediate**: Only if required by local regulations
