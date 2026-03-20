-- Rename subscription tiers: FREE→BASE, STARTER→BASE (no free tier)

-- Step 1: Drop default and convert column to text
ALTER TABLE "Organization" ALTER COLUMN "subscription" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "subscription" TYPE TEXT;

-- Step 2: Migrate existing data
UPDATE "Organization" SET "subscription" = 'BASE' WHERE "subscription" IN ('FREE', 'STARTER');

-- Step 3: Drop old enum and create new one
DROP TYPE "SubscriptionTier";
CREATE TYPE "SubscriptionTier" AS ENUM ('BASE', 'PRO', 'ENTERPRISE');

-- Step 4: Convert column back to enum
ALTER TABLE "Organization" ALTER COLUMN "subscription" TYPE "SubscriptionTier" USING ("subscription"::"SubscriptionTier");
ALTER TABLE "Organization" ALTER COLUMN "subscription" SET DEFAULT 'BASE';

-- Step 5: Update default maxInspectionsPerMonth from 10 to 25
ALTER TABLE "Organization" ALTER COLUMN "maxInspectionsPerMonth" SET DEFAULT 25;
