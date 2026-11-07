export type HealthDataSource =
  | "USER_REPORTED"
  | "MEASURED"
  | "IMPORTED"
  | "SYSTEM_DERIVED"
  | "PROFESSIONAL_RECORDED";

export type HealthDecisionStatus =
  | "READY"
  | "DECISION_PAUSED"
  | "BLOCKED"
  | "OVERRIDDEN";

export type HealthDecisionType =
  | "NEXT_SESSION"
  | "LOAD_INCREASE"
  | "VOLUME_ADJUSTMENT"
  | "NUTRITION_ADJUSTMENT"
  | "MEDIA_ANALYSIS";

export interface HealthEventEnvelope {
  eventId: string;
  clientEventId?: string;
  occurredAt: string;
  recordedAt: string;
  source: HealthDataSource;
  schemaVersion: string;
}

export interface HealthDataSufficiencyContract {
  decisionType: HealthDecisionType;
  minimumRequiredData: string[];
  optionalConfidenceData: string[];
  safeFallback: string;
  canPause: boolean;
}

export interface HealthDecisionExplanation {
  status: HealthDecisionStatus;
  reasonCodes: string[];
  confidence?: number;
  algorithmVersion: string;
  parameterSet?: string;
}

export interface AthleteCapabilityProfile {
  athleteId: string;
  generatedAt: string;
  capabilityVersion: string;
  signals: Record<string, number | string | boolean | null>;
}

export interface SessionDemandProfile {
  sessionId: string;
  generatedAt: string;
  demandVersion: string;
  signals: Record<string, number | string | boolean | null>;
}

export interface CompatibilityAssessment {
  status: "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNOBSERVED";
  reasonCodes: string[];
  confidence?: number;
}
