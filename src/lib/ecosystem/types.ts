export type EcosystemEntityType = "agent" | "application" | "framework" | "infrastructure" | "tool";
export type EcosystemSource = "github" | "npm";

export interface EcosystemEntity {
  id: string;
  name: string;
  type: EcosystemEntityType;
  description: string;
  websiteUrl: string;
  repositoryUrl?: string;
  npmPackage?: string;
  audiences: Array<"developer" | "business" | "general-user" | "researcher">;
  useCases: string[];
}

export interface EcosystemSignal {
  entityId: string;
  source: EcosystemSource;
  metric: "stars" | "forks" | "npm-weekly-downloads";
  value: number;
  previousValue: number | null;
  change: number | null;
  fetchedAt: string;
  attributionUrl: string;
  license: string;
}

export interface EcosystemScore {
  entityId: string;
  score: number;
  adoption: number;
  momentum: number;
  developerActivity: number;
  signalCount: number;
  computedAt: string;
}

export interface EcosystemSnapshot {
  fetchedAt: string;
  date: string;
  license: string;
  entities: EcosystemEntity[];
  signals: EcosystemSignal[];
  scores: EcosystemScore[];
}
