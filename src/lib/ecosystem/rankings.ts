import type { EcosystemEntity, EcosystemScore, EcosystemSignal } from "./types";

function normalize(value: number, ceiling: number): number {
  return Math.max(0, Math.min(1, Math.log10(Math.max(1, value)) / ceiling));
}

export function computeEcosystemScores(signals: EcosystemSignal[], now = new Date()): EcosystemScore[] {
  const byEntity = new Map<string, EcosystemSignal[]>();
  for (const signal of signals) {
    const current = byEntity.get(signal.entityId) ?? [];
    current.push(signal);
    byEntity.set(signal.entityId, current);
  }

  return [...byEntity.entries()].map(([entityId, rows]) => {
    const stars = rows.find((r) => r.metric === "stars")?.value ?? 0;
    const downloads = rows.find((r) => r.metric === "npm-weekly-downloads")?.value ?? 0;
    const forks = rows.find((r) => r.metric === "forks")?.value ?? 0;
    const adoption = Math.max(normalize(stars, 6), normalize(downloads, 8));
    const change = rows.filter((r) => r.change != null).map((r) => r.change!).reduce((a, b) => a + Math.max(0, b), 0);
    const momentum = Math.min(1, Math.log10(Math.max(1, change + 1)) / 5);
    const developerActivity = Math.max(normalize(forks, 5), normalize(stars, 6));
    return {
      entityId,
      score: Math.min(1, adoption * 0.5 + momentum * 0.3 + developerActivity * 0.2),
      adoption,
      momentum,
      developerActivity,
      signalCount: rows.length,
      computedAt: now.toISOString(),
    };
  }).sort((a, b) => b.score - a.score || a.entityId.localeCompare(b.entityId));
}

export function entitiesWithScores(entities: EcosystemEntity[], scores: EcosystemScore[]): Array<EcosystemEntity & { score: EcosystemScore | null }> {
  const byId = new Map(scores.map((score) => [score.entityId, score]));
  return entities.map((entity) => ({ ...entity, score: byId.get(entity.id) ?? null }));
}
