# App Bridge Implementation Guide

## Overview

This Shopify app now uses the latest version of App Bridge across all pages. The implementation includes proper navigation, resource picker functionality, and toast notifications.

## Installed Packages

- `@shopify/app-bridge`: ^3.7.11
- `@shopify/app-bridge-react`: ^4.2.8

## Implementation Structure

### 1. Navigation Component (`/app/components/AppNavigation.tsx`)

Enhanced navigation component that:

- Uses App Bridge's NavigationMenu for proper Shopify admin integration
- Maintains React Router Links for client-side navigation
- Automatically configures navigation items in Shopify admin

```tsx
// Features:
- Dashboard (/app)
- Exclusion Rules (/app/rules)
- Manage Discounts (/app/discounts)
- 🧪 Test (/app/test)
```

### 2. App Bridge Hook (`/app/hooks/useShopifyAppBridge.ts`)

Custom hook providing:

- **Resource Picker**: Select Products, Collections, or Customers
- **Toast Notifications**: Show success/error messages with App Bridge styling
- **Centralized App Bridge Logic**: Consistent interface across all pages

### 3. Page Integration

All main pages now import and use the App Bridge hook:

- `app/routes/app._index.tsx` - Dashboard with toast notifications
- `app/routes/app.rules.tsx` - Rules page with resource picker and toast
- `app/routes/app.discounts.tsx` - Discounts page with toast notifications
- `app/routes/app.test.tsx` - Test page with toast notifications

### 4. Main App Layout (`/app/routes/app.tsx`)

Updated to use the new AppNavigation component instead of inline navigation.

## Features Available

### Resource Picker

```tsx
const { showResourcePicker } = useShopifyAppBridge();

// Pick products
const products = await showResourcePicker("Product");

// Pick collections
const collections = await showResourcePicker("Collection");

// Pick customers
const customers = await showResourcePicker("Customer");
```

### Toast Notifications

```tsx
const { showToast } = useShopifyAppBridge();

// Success message
showToast("Operation completed successfully!", "success");

// Error message
showToast("Something went wrong", "error");

// Info message
showToast("Information message", "info");
```

## Build & Deployment

The app builds successfully with all App Bridge features:

```bash
npm run build  # ✅ Builds without errors
npm run dev    # ✅ Runs development server
```

## Navigation Flow

1. **Shopify Admin**: App Bridge NavigationMenu provides native navigation in Shopify admin
2. **Client-Side**: React Router Links handle internal navigation without page reloads
3. **Embedded**: s-app-nav and s-link elements work seamlessly in embedded environment

## Next Steps

- ✅ App Bridge implementation complete across all pages
- ✅ Navigation working with both Shopify admin and client-side routing
- ✅ Resource picker and toast functionality available
- ✅ Build system compatible with App Bridge dependencies

The app is now fully compatible with Shopify's latest App Bridge requirements and provides a modern, embedded app experience.
