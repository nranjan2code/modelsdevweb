export type ExternalSource = "hf" | "github";

export type ExternalSignalType =
  | "downloads"
  | "likes"
  | "trending"
  | "stars"
  | "forks"
  | "paper";

export interface ExternalSignal {
  source: ExternalSource;
  signalType: ExternalSignalType;
  /** Our canonical ModelGroup id — never a raw external id. */
  modelId: string;
  value: number;
  metadata: Record<string, unknown>;
  fetchedAt: string;
  license: string;
  attributionUrl: string;
}

export interface CompositeScore {
  groupId: string;
  score: number;
  breakdown: Record<string, number>;
  signalCount: number;
  computedAt: string;
}

export interface ExternalSignalsSnapshot {
  fetchedAt: string;
  signals: ExternalSignal[];
  compositeScores: CompositeScore[];
  license: string;
}

export interface EntityMapping {
  source: ExternalSource;
  externalId: string;
  groupId: string;
  confidence: number;
  method: "exact" | "fuzzy" | "manual";
  metadata?: Record<string, unknown>;
}

export const EXTERNAL_LICENSES: Record<ExternalSource, { name: string; url: string; requiresAttribution: boolean; commercialOk: boolean }> = {
  hf: { name: "Apache-2.0 / model-specific", url: "https://huggingface.co/docs/hub/api", requiresAttribution: true, commercialOk: true },
  github: { name: "repo-specific / API TOS", url: "https://docs.github.com/en/rest", requiresAttribution: true, commercialOk: true },
};