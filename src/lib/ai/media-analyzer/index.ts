/**
 * Media Analyzer — 4-Phase Defect Detection Pipeline (v2)
 *
 * Drop-in replacement for the original media-analyzer.ts.
 * Re-exports all public functions with identical signatures.
 *
 * The pipeline runs a 4-phase analysis:
 *   Phase 1: Focused per-photo inspection (~20 calls, detect + quantify in one call)
 *   Phase 2: Multi-photo comparison scans (~5 calls, paint/alignment/tires/interior/wear)
 *   Phase 3: Targeted re-scans (0-5 calls, conditional on high-signal findings)
 *   Phase 4: Score synthesis (1 call, all exterior photos + findings → final scores)
 *
 * Results are memoized per media set so concurrent calls from Promise.all
 * share a single pipeline execution.
 */

// ── New pipeline entry points (backward-compatible signatures) ──
export { analyzeVehicleCondition, scanForUnexpectedIssues, assessTires } from "./legacy/compat";

// ── Unchanged legacy functions ──
export { analyzeRiskMedia, selectCostTierFromFailures } from "./legacy/risk-analysis";
export { extractVinFromPhoto } from "./legacy/vin-ocr";
export { extractOdometerFromPhoto } from "./legacy/odometer-ocr";
export { estimateTireReplacementCost } from "./legacy/tire-cost";

// ── Pipeline control ──
export { clearPipelineCache } from "./pipeline";

// ── Types re-exports for consumers ──
export type { VehicleInfo, MediaForAnalysis } from "./types";
