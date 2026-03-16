// NHTSA API response types

export interface NHTSAComplaint {
  odiNumber: string;
  manufacturer: string;
  crash: boolean;
  fire: boolean;
  numberOfInjuries: number;
  numberOfDeaths: number;
  dateOfIncident: string;
  dateComplaintFiled: string;
  component: string;
  summary: string;
}

export interface NHTSARecall {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportDate?: string;
}

export interface NHTSAInvestigation {
  investigationId: string;
  investigationStatus: string;
  make: string;
  model: string;
  year: string;
  component: string;
  summary: string;
  consequence: string;
}

// Aggregated risk profile types

export type Severity = "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "INFO";

export type RiskSource =
  | "CURATED"
  | "AI_GENERATED"
  | "NHTSA_COMPLAINTS"
  | "NHTSA_RECALLS"
  | "NHTSA_INVESTIGATIONS"
  | "MERGED";

export type Likelihood = "VERY_COMMON" | "COMMON" | "OCCASIONAL" | "RARE";

export interface AggregatedRisk {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  category: string;
  source: RiskSource;
  cost: { low: number; high: number };
  position: { x: number; y: number; z: number };
  symptoms: string[];
  capturePrompts: string[];
  inspectionGuidance: string;
  complaintCount?: number;
  hasActiveRecall?: boolean;
  investigationId?: string;
  relatedRecalls?: NHTSARecall[];
  /** AI-generated specific summary replacing generic description */
  aiSummary?: string;
  /** AI-generated specific capture prompts for this exact risk */
  aiCapturePrompts?: string[];

  // Structured inspection guidance (AI-generated known issues)
  /** Specific component/system to check */
  whatToCheck?: string;
  /** Exact location on the vehicle */
  whereToLook?: string;
  /** Step-by-step inspection method */
  howToInspect?: string;
  /** Observable indicators of the failure */
  signsOfFailure?: string[];
  /** Consequence if overlooked + cost context */
  whyItMatters?: string;
  /** How commonly this issue occurs on this vehicle */
  likelihood?: Likelihood;
}

export interface AIAnalysisResult {
  riskId: string;
  verdict: "CONFIRMED" | "CLEARED" | "INCONCLUSIVE";
  confidence: number;
  explanation: string;
  evidenceMediaIds: string[];
  /** Observed condition level of the component */
  observedCondition?: "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "FAILED";
  /** Specific visual observations the AI identified */
  visualObservations?: string[];
  /** Recommended next action if CONFIRMED or INCONCLUSIVE */
  suggestedAction?: string;
}

export interface UnexpectedFinding {
  title: string;
  description: string;
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
  category: string;
  photoIndex: number;
  confidence: number;
}

export interface OverallConditionResult {
  overallGrade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  exteriorCondition: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  interiorVisible: boolean;
  engineBayCondition?: "CLEAN" | "NORMAL" | "DIRTY" | "CONCERNING";
  unexpectedFindings: UnexpectedFinding[];
  summary: string;
}

export interface AggregatedRiskProfile {
  vehicleId: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  curatedProfileId?: string;
  nhtsaData: {
    complaintCount: number;
    recallCount: number;
    investigationCount: number;
    complaintsByComponent: Record<string, number>;
  };
  aggregatedRisks: AggregatedRisk[];
  generatedAt: string;
}

export interface RiskCheckStatus {
  riskId: string;
  status: "NOT_CHECKED" | "CONFIRMED" | "NOT_FOUND" | "UNABLE_TO_INSPECT";
  notes?: string;
  findingId?: string;
  mediaIds?: string[];
  hasPhotoEvidence?: boolean;
  checkedAt?: string;
}
