-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "maxInspectionsPerMonth" INTEGER NOT NULL DEFAULT 10;
