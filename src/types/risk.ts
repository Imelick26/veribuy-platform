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
  | "MERGED"
  | "PHOTO_SCAN";

export type Likelihood = "VERY_COMMON" | "COMMON" | "OCCASIONAL" | "RARE";

// Guided inspection question types

export interface InspectionQuestion {
  id: string;              // "q0", "q1", etc.
  question: string;        // "Does the steering column have excessive play?"
  failureAnswer: "yes" | "no";  // which answer indicates a problem
  mediaPrompt?: string;    // "Photograph the steering column play"
  order: number;
}

export interface QuestionAnswer {
  questionId: string;
  answer: "yes" | "no" | null;
  answeredAt: string;
  mediaIds?: string[];     // photos taken for this specific question
}

export interface CostTier {
  condition: "MINOR" | "MODERATE" | "SEVERE";
  label: string;
  costLow: number;   // cents
  costHigh: number;   // cents
}

export interface AggregatedRisk {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  category: string;
  source: RiskSource;
  /** Short keyword for 3D hotspot sub-position placement (e.g., "oil", "ball_joint", "differential") */
  componentHint?: string;
  /** Full pre-inspection cost range in cents (MINOR low → SEVERE high) */
  cost: { low: number; high: number };
  /** Severity-based cost tiers — narrows after inspection */
  costTiers?: CostTier[];
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
  /** How this risk should be checked: visual (questions + evidence photo on failure), manual (questions only — not photographable), photo (legacy AI vision), or both (legacy) */
  checkMethod?: "photo" | "manual" | "both" | "visual";
  /** Structured yes/no questions for guided inspection */
  inspectionQuestions?: InspectionQuestion[];
  /** Plain-English explanation of what this component is and why it matters */
  whatThisIs?: string;
  /** Step-by-step wayfinding directions to locate the component on the vehicle */
  howToLocate?: string;
  /** Single evidence photo prompt, shown only when failure is detected */
  evidencePrompt?: string;
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
  /** Refined cost range based on observed condition, mapped from costTiers (in cents) */
  refinedCost?: { low: number; high: number; tierCondition: string; tierLabel: string };
}

export interface UnexpectedFinding {
  title: string;
  description: string;
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
  category: string;
  photoIndex: number;
  confidence: number;
}

/** Result from scanForUnexpectedIssues() — grade fields removed, now handled by ConditionAssessment */
export interface OverallConditionResult {
  unexpectedFindings: UnexpectedFinding[];
  summary: string;
}

// ---------------------------------------------------------------------------
//  AI-Driven Condition Assessment (4-area photo scoring)
// ---------------------------------------------------------------------------

export interface AreaConditionDetail {
  score: number;              // 1-10
  confidence: number;         // 0-1
  keyObservations: string[];
  concerns: string[];
  summary: string;
  /** Detailed explanation of why this score was chosen */
  scoreJustification?: string;
}

export interface ConditionAssessment {
  overallScore: number;           // 0-100 weighted composite
  exteriorBodyScore: number;      // 1-10
  interiorScore: number;          // 1-10
  mechanicalVisualScore: number;  // 1-10
  underbodyFrameScore: number;    // 1-10

  exteriorBody: AreaConditionDetail;
  interior: AreaConditionDetail;
  mechanicalVisual: AreaConditionDetail;
  underbodyFrame: AreaConditionDetail;

  summary: string;
  photoCoverage: {
    exteriorBody: number;   // count of photos used
    interior: number;
    mechanicalVisual: number;
    underbodyFrame: number;
  };
  /** Per-tire tread depth and condition from AI vision analysis */
  tireAssessment?: TireAssessment;
}

export type TireConditionLevel = "NEW" | "GOOD" | "HALF_WORN" | "WORN" | "REPLACE";

export interface TireCondition {
  /** Estimated tread depth in 32nds of an inch (new ~10-11, replace ~2-3) */
  treadDepth32nds: number;
  condition: TireConditionLevel;
  observations: string[];
}

export interface TireAssessment {
  frontDriver: TireCondition;
  frontPassenger: TireCondition;
  rearDriver: TireCondition;
  rearPassenger: TireCondition;
  /** Overall tire condition score 1-10 */
  overallTireScore: number;
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
  /** Answers to guided inspection questions */
  questionAnswers?: QuestionAnswer[];
}
