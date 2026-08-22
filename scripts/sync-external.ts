import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/data";
import { computeCompositeScore } from "../src/lib/scoring/composite";
import type { ExternalSignal, ExternalSignalsSnapshot } from "../src/lib/pipeline/external-types";
import { fetchHFSignals } from "./sources/huggingface";
import { fetchGitHubSignals } from "./sources/github";

const ROOT = path.dirname(import.meta.dirname);
const EXTERNAL_FILE = path.join(ROOT, "snapshots", "latest", "external-signals.json");
const EXTERNAL_HISTORY_DIR = path.join(ROOT, "snapshots", "external-history");
const SIGNAL_RETENTION_DAYS = 30;

async function loadPreviousSignals(): Promise<ExternalSignal[]> {
  try {
    const buf = await readFile(EXTERNAL_FILE, "utf8");
    const data = JSON.parse(buf) as ExternalSignalsSnapshot;
    return data.signals;
  } catch {
    return [];
  }
}

function mergeSignals(existing: ExternalSignal[], fresh: ExternalSignal[]): ExternalSignal[] {
  const byKey = new Map<string, ExternalSignal>();

  for (const s of existing) {
    const key = `${s.source}:${s.signalType}:${s.modelId}`;
    if (!byKey.has(key) || new Date(s.fetchedAt) < new Date(byKey.get(key)!.fetchedAt)) {
      byKey.set(key, s);
    }
  }

  for (const s of fresh) {
    const key = `${s.source}:${s.signalType}:${s.modelId}`;
    if (!byKey.has(key) || new Date(s.fetchedAt) > new Date(byKey.get(key)!.fetchedAt)) {
      byKey.set(key, s);
    }
  }

  const merged = [...byKey.values()];

  const cutoff = Date.now() - SIGNAL_RETENTION_DAYS * 24 * 3600 * 1000;
  return merged.filter((s) => new Date(s.fetchedAt).getTime() >= cutoff);
}

async function main(): Promise<void> {
  console.log("[sync-external] Starting external data sync");

  const catalog = await getCatalog();
  const groups = catalog.groups;

  const previousSignals = await loadPreviousSignals();
  console.log(`[sync-external] Loaded ${previousSignals.length} previous signals`);

  const freshSignals: ExternalSignal[] = [];

  for (const [name, fetcher] of [
    ["Hugging Face", fetchHFSignals],
    ["GitHub", fetchGitHubSignals],
  ] as const) {
    console.log(`[sync-external] Fetching ${name} signals...`);
    try {
      const signals = await fetcher(groups);
      freshSignals.push(...signals);
      console.log(`[sync-external] ${name}: ${signals.length} signals`);
    } catch (err) {
      console.error(`[sync-external] ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[sync-external] Total fresh signals: ${freshSignals.length}`);

  const groupIds = new Set(groups.map((g) => g.id));
  const resolvable = freshSignals.filter((s) => groupIds.has(s.modelId));
  const dropped = freshSignals.length - resolvable.length;
  if (dropped > 0) console.warn(`[sync-external] dropped ${dropped} signals referencing unknown groups`);

  const mergedSignals = mergeSignals(previousSignals, resolvable);
  console.log(`[sync-external] Merged signals: ${mergedSignals.length}`);

  const compositeScores = computeCompositeScore(mergedSignals);
  console.log(`[sync-external] Computed ${compositeScores.length} composite scores`);

  const snapshot: ExternalSignalsSnapshot = {
    fetchedAt: new Date().toISOString(),
    signals: mergedSignals,
    compositeScores,
    license: "mixed — see per-signal license and attributionUrl fields",
  };

  await mkdir(path.dirname(EXTERNAL_FILE), { recursive: true });
  await writeFile(EXTERNAL_FILE, JSON.stringify(snapshot));

  const date = new Date().toISOString().slice(0, 10);
  await mkdir(EXTERNAL_HISTORY_DIR, { recursive: true });
  await writeFile(path.join(EXTERNAL_HISTORY_DIR, `${date}.json`), JSON.stringify(snapshot));

  console.log(`[sync-external] Written to ${EXTERNAL_FILE}`);
  compositeScores.slice(0, 5).forEach((sc, i) => {
    const group = groups.find((g) => g.id === sc.groupId);
    console.log(`  ${i + 1}. ${group?.name ?? sc.groupId} (${sc.score.toFixed(3)}, ${sc.signalCount} signals)`);
  });
}

main().catch((err) => {
  console.error("[sync-external] Failed:", err);
  process.exit(1);
});