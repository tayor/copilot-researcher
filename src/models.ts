export type SessionStatus = "draft" | "scored" | "reported";
export type EvidenceDirection = "support" | "contradict" | "neutral";
export type ArtifactKind =
  | "dataset"
  | "note"
  | "script"
  | "figure"
  | "report"
  | "other";
export type EventType =
  | "workspace_initialized"
  | "session_created"
  | "hypothesis_added"
  | "evidence_added"
  | "artifact_added"
  | "session_scored"
  | "report_generated";

export interface RankingWeights {
  novelty: number;
  feasibility: number;
  impact: number;
  confidence: number;
  evidence: number;
  contradictionPenalty: number;
}

export interface WorkspaceConfig {
  version: number;
  name: string;
  createdAt: string;
  defaultTemplateId: string;
  defaultWeights: RankingWeights;
}

export interface ResearchTemplate {
  id: string;
  name: string;
  description: string;
  prompts: string[];
  evidenceQuestions: string[];
  recommendedArtifacts: ArtifactKind[];
  nextStepGuidance: string[];
  defaultWeights?: Partial<RankingWeights>;
}

export interface ResearchSession {
  id: string;
  goal: string;
  question: string;
  templateId: string;
  templateName: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  summary: string;
  rankedHypothesisIds: string[];
  weights: RankingWeights;
}

export interface HypothesisMetrics {
  novelty: number;
  feasibility: number;
  impact: number;
  confidence: number;
}

export interface HypothesisScore {
  total: number;
  baseScore: number;
  evidenceScore: number;
  contradictionScore: number;
  rank: number;
  nextAction: string;
}

export interface Hypothesis {
  id: string;
  sessionId: string;
  title: string;
  statement: string;
  tags: string[];
  metrics: HypothesisMetrics;
  createdAt: string;
  updatedAt: string;
  score?: HypothesisScore;
}

export interface Evidence {
  id: string;
  sessionId: string;
  hypothesisId: string;
  summary: string;
  source: string;
  strength: number;
  relevance: number;
  direction: EvidenceDirection;
  createdAt: string;
}

export interface Artifact {
  id: string;
  sessionId: string;
  hypothesisId?: string;
  label: string;
  path: string;
  kind: ArtifactKind;
  description: string;
  sha256?: string;
  createdAt: string;
}

export interface LedgerEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: EventType;
  timestamp: string;
  payload: TPayload;
}

export interface CreateSessionInput {
  goal: string;
  question: string;
  templateId?: string;
}

export interface AddHypothesisInput {
  sessionId: string;
  title: string;
  statement: string;
  novelty: number;
  feasibility: number;
  impact: number;
  confidence?: number;
  tags?: string[];
}

export interface AddEvidenceInput {
  sessionId: string;
  hypothesisId: string;
  summary: string;
  source: string;
  strength: number;
  relevance: number;
  direction: EvidenceDirection;
}

export interface AddArtifactInput {
  sessionId: string;
  label: string;
  path: string;
  kind?: ArtifactKind;
  description?: string;
  hypothesisId?: string;
}
