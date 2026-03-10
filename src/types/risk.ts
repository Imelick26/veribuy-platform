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
  | "NHTSA_COMPLAINTS"
  | "NHTSA_RECALLS"
  | "NHTSA_INVESTIGATIONS"
  | "MERGED";

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
  checkedAt?: string;
}
