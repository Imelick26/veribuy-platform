-- Standardize on TRADE_IN as the default acquisition type for new inspections.
-- Existing rows keep whatever value they have (we do not overwrite completed
-- inspections' acquisition type — those were run under WHOLESALE assumptions).
ALTER TABLE "Inspection" ALTER COLUMN "acquisitionType" SET DEFAULT 'TRADE_IN';
