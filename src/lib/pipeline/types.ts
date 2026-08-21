export type Modality = "text" | "image" | "pdf" | "audio" | "video";

export type ModelStatus = "alpha" | "beta" | "deprecated";

export interface Cost {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  reasoning: number | null;
  inputAudio: number | null;
  outputAudio: number | null;
  tiers: boolean;
}

export interface Limits {
  context: number | null;
  output: number | null;
  input: number | null;
}

export interface Modalities {
  input: Modality[];
  output: Modality[];
}

export interface Listing {
  key: string;
  providerId: string;
  providerName: string;
  modelId: string;
  canonicalId: string | null;
  name: string;
  family: string | null;
  description: string | null;
  status: ModelStatus | null;
  experimental: boolean;
  attachment: boolean;
  reasoning: boolean;
  toolCall: boolean;
  structuredOutput: boolean | null;
  temperature: boolean;
  openWeights: boolean;
  knowledge: string | null;
  releaseDate: string | null;
  lastUpdated: string | null;
  modalities: Modalities;
  limit: Limits;
  cost: Cost;
}

export interface WeightLink {
  label: string;
  url: string;
}

export interface Benchmark {
  name: string;
  score: number;
  metric: string | null;
  source: string | null;
}

export interface CanonicalModel {
  id: string;
  labId: string;
  name: string;
  description: string | null;
  family: string | null;
  attachment: boolean | null;
  reasoning: boolean | null;
  toolCall: boolean | null;
  structuredOutput: boolean | null;
  temperature: boolean | null;
  openWeights: boolean | null;
  knowledge: string | null;
  releaseDate: string | null;
  lastUpdated: string | null;
  modalities: Modalities | null;
  limit: Limits | null;
  weights: WeightLink[];
  benchmarks: Benchmark[];
}

export interface Provider {
  id: string;
  name: string;
  doc: string | null;
  npm: string | null;
  api: string | null;
  env: string[];
  modelCount: number;
}

export type EventType =
  | "model_added"
  | "model_removed"
  | "deprecated"
  | "repriced"
  | "context_changed"
  | "capability_changed"
  | "provider_added"
  | "provider_removed";

export interface Change {
  field: string;
  old: unknown;
  new: unknown;
}

export interface Event {
  id: string;
  type: EventType;
  date: string;
  modelKey: string;
  modelName: string;
  canonicalId: string | null;
  labId: string | null;
  providerId: string | null;
  changes: Change[];
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  favicon: string | null;
  publishedAt: string | null;
  score: number;
  snippet: string;
  modelIds: string[];
  labIds: string[];
}
