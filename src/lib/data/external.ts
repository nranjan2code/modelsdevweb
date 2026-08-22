import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CompositeScore, ExternalSignal, ExternalSignalsSnapshot } from "../pipeline/external-types";
import { computeCompositeScore } from "../scoring/composite";

const LATEST = () => path.join(process.cwd(), "snapshots", "latest");

let externalCache: ExternalSignalsSnapshot | null = null;

export async function getExternalSignals(): Promise<ExternalSignalsSnapshot> {
  if (externalCache) return externalCache;
  try {
    const buf = await readFile(path.join(LATEST(), "external-signals.json"), "utf8");
    const parsed = JSON.parse(buf) as Partial<ExternalSignalsSnapshot>;
    externalCache = {
      fetchedAt: parsed.fetchedAt ?? new Date(0).toISOString(),
      signals: parsed.signals ?? [],
      compositeScores: parsed.compositeScores ?? [],
      license: parsed.license ?? "mixed",
    };
  } catch {
    externalCache = { fetchedAt: new Date(0).toISOString(), signals: [], compositeScores: [], license: "mixed" };
  }
  return externalCache;
}

export async function getCompositeScores(): Promise<CompositeScore[]> {
  const snapshot = await getExternalSignals();
  return snapshot.compositeScores;
}

export async function getSignalsForModel(modelId: string): Promise<ExternalSignal[]> {
  const snapshot = await getExternalSignals();
  return snapshot.signals.filter((s) => s.modelId === modelId);
}

/**
 * Top models by stored composite score. The score itself is computed once per
 * sync by computeCompositeScore — readers never re-derive rankings.
 */
export async function getTopExternalModels(limit = 10): Promise<CompositeScore[]> {
  const scores = await getCompositeScores();
  return scores.filter((s) => s.score > 0.05 && s.signalCount >= 2).slice(0, limit);
}

/** Same scoring algorithm, restricted to signals fetched within `days`. */
export async function getTrendingExternalModels(days = 7, limit = 10): Promise<CompositeScore[]> {
  const snapshot = await getExternalSignals();
  if (snapshot.signals.length === 0) return [];
  const cutoff = Date.now() - days * 86_400_000;
  const recent = snapshot.signals.filter((s) => {
    const t = new Date(s.fetchedAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  return computeCompositeScore(recent).filter((s) => s.signalCount >= 2).slice(0, limit);
}