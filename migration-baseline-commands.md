# 🗄️ Production Database Baseline Commands

## Scenario: Existing production database with v1.0.0 data

### Step 1: Connect to production database

```bash
# Set DATABASE_URL to production database
export DATABASE_URL="<railway-production-postgres-url>"
```

### Step 2: Mark existing migrations as applied (baseline)

```bash
# These migrations were likely already applied in production v1.0.0
npx prisma migrate resolve --applied 20251224184301_init
npx prisma migrate resolve --applied 20251225171524_fix_userid_type
```

### Step 3: Apply new v2.0.0 migrations

```bash
# Only these new migrations will be applied
npx prisma migrate deploy
```

## Alternative: Railway Auto-Deploy Solution

### Update railway.json for safe migrations:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start:production:safe",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

### Add safe migration command in package.json:

```json
{
  "scripts": {
    "start:production:safe": "NODE_ENV=production npm run setup:production:safe && npm run start",
    "setup:production:safe": "prisma generate && npx prisma migrate resolve --applied 20251224184301_init --skip-seed; npx prisma migrate resolve --applied 20251225171524_fix_userid_type --skip-seed; prisma migrate deploy"
  }
}
```
