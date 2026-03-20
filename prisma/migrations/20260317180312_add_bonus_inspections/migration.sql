-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "bonusInspections" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InspectionPackPurchase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "purchasedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InspectionPackPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionPackPurchase_stripeSessionId_key" ON "InspectionPackPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "InspectionPackPurchase_orgId_idx" ON "InspectionPackPurchase"("orgId");

-- CreateIndex
CREATE INDEX "InspectionPackPurchase_stripeSessionId_idx" ON "InspectionPackPurchase"("stripeSessionId");

-- AddForeignKey
ALTER TABLE "InspectionPackPurchase" ADD CONSTRAINT "InspectionPackPurchase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
