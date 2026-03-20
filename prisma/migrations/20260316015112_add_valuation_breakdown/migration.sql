-- AlterTable
ALTER TABLE "MarketAnalysis" ADD COLUMN     "adjustedValueBeforeRecon" INTEGER,
ADD COLUMN     "conditionGrade" TEXT,
ADD COLUMN     "conditionMultiplier" DOUBLE PRECISION,
ADD COLUMN     "conditionScore" INTEGER,
ADD COLUMN     "fairValueAtBaseline" INTEGER,
ADD COLUMN     "historyBreakdown" JSONB,
ADD COLUMN     "historyMultiplier" DOUBLE PRECISION,
ADD COLUMN     "overpayingMax" INTEGER,
ADD COLUMN     "priceBands" JSONB;
