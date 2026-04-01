/**
 * Internal types for the 4-phase defect detection pipeline (v2).
 *
 * Key design change from v1: detection and quantification happen in ONE call.
 * There is no separate "raw detection" vs "quantified defect" — every finding
 * comes back fully quantified from the first pass.
 */

import type { AreaConditionDetail, TireAssessment, UnexpectedFinding } from "@/types/risk";

// ---------------------------------------------------------------------------
//  Shared types
// ---------------------------------------------------------------------------

export interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  mileage?: number | null;
  bodyStyle?: string;
}

export interface MediaForAnalysis {
  id: string;
  url: string;
  captureType: string;
}

export type PaintDamageLevel = "none" | "clear_coat" | "base_coat" | "bare_metal";
export type AffectsArea = "exterior" | "interior" | "mechanical" | "underbody";
export type SeverityLevel = "minor" | "moderate" | "major" | "critical";

// ---------------------------------------------------------------------------
//  Phase 1: Detected finding (detect + quantify in one call)
// ---------------------------------------------------------------------------

/**
 * A defect found during Phase 1 inspection. Unlike v1 which had separate
 * "detection" and "quantification" types, each finding is fully quantified
 * on first detection — the model is already looking at the photo.
 */
export interface DetectedFinding {
  defectType: string;             // e.g. "dent", "paint_chip", "rust_bubble"
  location: string;               // e.g. "hood center-left, 8 inches from leading edge"
  severity: SeverityLevel;
  confidence: number;             // 0-1
  dimensions?: string;            // e.g. "approx 4in x 3in"
  paintDamage?: PaintDamageLevel;
  repairApproach: string;         // e.g. "PDR", "sand and repaint panel"
  repairCostLow: number;          // cents
  repairCostHigh: number;         // cents
  description: string;            // 2-3 sentence description for inspection report

  // Traceability
  photoId: string;
  captureType: string;
  affectsArea: AffectsArea;
}

/** Result from a single Phase 1 inspection call */
export interface InspectionCallResult {
  captureType: string;
  photoId: string;
  findings: DetectedFinding[];
  areaCondition: "good" | "fair" | "worn" | "damaged";
  notes: string;
  error?: string;
}

// ---------------------------------------------------------------------------
//  Phase 2: Comparison scan findings
// ---------------------------------------------------------------------------

/** A finding from multi-photo comparison (paint, alignment, tires, etc.) */
export interface ComparisonFinding {
  title: string;
  description: string;
  severity: SeverityLevel;
  confidence: number;
  type: "paint_mismatch" | "panel_alignment" | "tire_inconsistency" | "wear_inconsistency" | "mileage_discrepancy" | "other";
  affectedAreas: string[];        // e.g. ["driver door", "driver fender"]
  repairCostLow?: number;         // cents (if applicable)
  repairCostHigh?: number;
}

/** Tire assessment from the dedicated comparison call */
export interface TireComparisonResult {
  tireAssessment: TireAssessment;
  findings: ComparisonFinding[];
}

/** All Phase 2 results combined */
export interface ComparisonResults {
  paintFindings: ComparisonFinding[];
  alignmentFindings: ComparisonFinding[];
  tireResult: TireComparisonResult;
  interiorFindings: ComparisonFinding[];
  wearFindings: ComparisonFinding[];
  apiCalls: number;
}

// ---------------------------------------------------------------------------
//  Phase 3: Re-scan triggers and results
// ---------------------------------------------------------------------------

export type RescanTrigger =
  | "paint_mismatch"
  | "panel_gaps"
  | "rust_cluster"
  | "flood_indicators"
  | "heavy_towing";

export interface RescanResult {
  trigger: RescanTrigger;
  findings: DetectedFinding[];
  comparisonFindings: ComparisonFinding[];
  apiCalls: number;
}

// ---------------------------------------------------------------------------
//  Phase 4: Score synthesis
// ---------------------------------------------------------------------------

export interface SynthesisResult {
  areaScores: {
    exteriorBody: AreaConditionDetail;
    interior: AreaConditionDetail;
    mechanicalVisual: AreaConditionDetail;
    underbodyFrame: AreaConditionDetail;
  };
  tireAssessment: TireAssessment;
  crossFindings: ComparisonFinding[];
  redFlags: string[];
  overallSummary: string;
}

// ---------------------------------------------------------------------------
//  Full Pipeline Result
// ---------------------------------------------------------------------------

export interface PipelineResult {
  /** All findings from Phase 1 per-photo inspection */
  findings: DetectedFinding[];
  /** All findings from Phase 2 comparison scans */
  comparisonFindings: ComparisonFinding[];
  /** Any additional findings from Phase 3 re-scans */
  rescanFindings: DetectedFinding[];
  /** Final scores and assessment from Phase 4 */
  synthesis: SynthesisResult;
  /** All findings converted to UnexpectedFinding format for legacy compat */
  unexpectedFindings: UnexpectedFinding[];
  /** Pipeline execution metadata */
  metadata: PipelineMetadata;
}

export interface PipelineMetadata {
  totalApiCalls: number;
  phase1Calls: number;
  phase2Calls: number;
  phase3Calls: number;
  phase4Calls: number;
  totalFindings: number;
  comparisonFindings: number;
  rescanFindings: number;
  durationMs: number;
}
