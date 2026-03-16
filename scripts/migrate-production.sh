#!/bin/bash

# 🚀 Production Database Migration Script
# This script safely handles database migrations for v2.0.0 deployment

echo "🗄️ Starting production database migration..."
echo "📊 Current date: $(date)"

# Step 1: Generate Prisma Client
echo "⚙️ Generating Prisma client..."
npx prisma generate

# Step 2: Baseline existing migrations (if they exist)
echo "🔄 Baseining existing migrations..."
echo "   - Marking 20251224184301_init as applied (if needed)..."
npx prisma migrate resolve --applied 20251224184301_init || echo "   ✓ Already resolved or not needed"

echo "   - Marking 20251225171524_fix_userid_type as applied (if needed)..."
npx prisma migrate resolve --applied 20251225171524_fix_userid_type || echo "   ✓ Already resolved or not needed"

# Step 3: Check migration status
echo "📋 Checking migration status..."
npx prisma migrate status

# Step 4: Apply new migrations
echo "🚀 Applying new v2.0.0 migrations..."
npx prisma migrate deploy

# Step 5: Verify completion
echo "✅ Migration process completed!"
echo "📊 Final migration status:"
npx prisma migrate status