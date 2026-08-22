import type { ExternalSignal, ExternalSignalType, ExternalSource, CompositeScore } from "../pipeline/external-types";

/**
 * Each signal is normalized to 0-1 by a source-specific curve (log for
 * power-law counts like downloads/stars, linear for bounded metrics), weighted,
 * then half-life-decayed by signal age before aggregation.
 */
interface SignalWeightConfig {
  weight: number;
  decayHalfLifeDays: number;
  normalize: (value: number) => number;
}

const SIGNAL_CONFIGS: Partial<Record<ExternalSource, Partial<Record<ExternalSignalType, SignalWeightConfig>>>> = {
  hf: {
    downloads: { weight: 0.4, decayHalfLifeDays: 30, normalize: (v) => Math.min(1, Math.log10(Math.max(1, v)) / 7) },
    likes: { weight: 0.3, decayHalfLifeDays: 60, normalize: (v) => Math.min(1, Math.log10(Math.max(1, v)) / 4.5) },
    trending: { weight: 0.2, decayHalfLifeDays: 7, normalize: (v) => Math.min(1, v / 2000) },
    paper: { weight: 0.1, decayHalfLifeDays: 14, normalize: (v) => Math.min(1, v) },
  },
  github: {
    stars: { weight: 0.75, decayHalfLifeDays: 90, normalize: (v) => Math.min(1, Math.log10(Math.max(1, v)) / 5) },
    forks: { weight: 0.25, decayHalfLifeDays: 90, normalize: (v) => Math.min(1, Math.log10(Math.max(1, v)) / 4) },
  },
};

export function activeSignals(): Array<{ source: ExternalSource; signalType: ExternalSignalType }> {
  const out: Array<{ source: ExternalSource; signalType: ExternalSignalType }> = [];
  for (const [source, types] of Object.entries(SIGNAL_CONFIGS)) {
    for (const signalType of Object.keys(types ?? {})) {
      out.push({ source: source as ExternalSource, signalType: signalType as ExternalSignalType });
    }
  }
  return out;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/**
 * Absolute-decay composite: contributions are summed against the FULL weight
 * budget of every active source/type pair, so staleness and missing sources
 * both lower the score. Rankings therefore move as signals age and reward
 * multi-source corroboration instead of being invariant to it.
 */
export function computeCompositeScore(
  signals: ExternalSignal[],
  now: Date = new Date(),
): CompositeScore[] {
  const byGroup = new Map<string, ExternalSignal[]>();
  for (const s of signals) {
    if (!Number.isFinite(s.value)) continue;
    const arr = byGroup.get(s.modelId);
    if (arr) arr.push(s);
    else byGroup.set(s.modelId, [s]);
  }

  const results: CompositeScore[] = [];

  for (const [groupId, groupSignals] of byGroup) {
    let totalWeightedScore = 0;
    let anyActive = false;
    const breakdown: Record<string, number> = {};

    for (const s of groupSignals) {
      const config = SIGNAL_CONFIGS[s.source]?.[s.signalType];
      if (!config || config.weight <= 0) continue;
      anyActive = true;

      const fetchedMs = new Date(s.fetchedAt).getTime();
      if (!Number.isFinite(fetchedMs)) continue;
      const ageDays = Math.max(0, (now.getTime() - fetchedMs) / 86_400_000);
      const decay = Math.pow(0.5, ageDays / config.decayHalfLifeDays);

      const normalized = clamp01(config.normalize(s.value));
      const effectiveWeight = config.weight * decay;
      const contribution = normalized * effectiveWeight;

      breakdown[`${s.source}:${s.signalType}`] = contribution;
      totalWeightedScore += contribution;
    }

    const budget = Object.values(SIGNAL_CONFIGS).reduce(
      (acc, types) => acc + Object.values(types ?? {}).reduce((a, c) => a + c.weight, 0),
      0,
    );
    if (budget <= 0 || !anyActive) continue;

    results.push({
      groupId,
      score: clamp01(totalWeightedScore / budget),
      breakdown,
      signalCount: groupSignals.length,
      computedAt: now.toISOString(),
    });
  }

  return results.sort((a, b) => b.score - a.score || a.groupId.localeCompare(b.groupId));
}