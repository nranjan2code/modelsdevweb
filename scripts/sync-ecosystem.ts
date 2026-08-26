import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ECOSYSTEM_ENTITIES } from "../src/lib/ecosystem/registry";
import { computeEcosystemScores } from "../src/lib/ecosystem/rankings";
import type { EcosystemSignal, EcosystemSnapshot } from "../src/lib/ecosystem/types";
import { fetchEcosystemSignals } from "./sources/ecosystem";

const ROOT = path.dirname(import.meta.dirname);
const LATEST = path.join(ROOT, "snapshots", "ecosystem", "latest.json");
const HISTORY = path.join(ROOT, "snapshots", "ecosystem");
const REFRESH_INTERVAL_HOURS = 24;

async function readPrevious(): Promise<EcosystemSnapshot | null> {
  try { return JSON.parse(await readFile(LATEST, "utf8")) as EcosystemSnapshot; } catch { return null; }
}

function validate(signals: EcosystemSignal[]): void {
  const valid = new Set(ECOSYSTEM_ENTITIES.map((entity) => entity.id));
  const keys = new Set<string>();
  for (const signal of signals) {
    const key = `${signal.entityId}:${signal.source}:${signal.metric}`;
    if (!valid.has(signal.entityId)) throw new Error(`unknown ecosystem entity ${signal.entityId}`);
    if (keys.has(key)) throw new Error(`duplicate ecosystem signal ${key}`);
    if (!Number.isFinite(signal.value) || signal.value < 0) throw new Error(`invalid ecosystem value for ${key}`);
    if (!signal.attributionUrl || !signal.license) throw new Error(`missing provenance for ${key}`);
    keys.add(key);
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const previous = await readPrevious();
  const age = previous ? (Date.now() - Date.parse(previous.fetchedAt)) / 3_600_000 : Number.POSITIVE_INFINITY;
  if (!force && Number.isFinite(age) && age >= 0 && age < REFRESH_INTERVAL_HOURS) {
    console.log(`[sync-ecosystem] last refresh was ${age.toFixed(1)}h ago (< ${REFRESH_INTERVAL_HOURS}h) — skipping`);
    return;
  }

  const fresh = await fetchEcosystemSignals(ECOSYSTEM_ENTITIES, previous?.signals ?? []);
  if (fresh.length === 0) {
    console.warn("[sync-ecosystem] no signals fetched — keeping previous snapshot");
    return;
  }
  validate(fresh);
  const fetchedAt = new Date().toISOString();
  const snapshot: EcosystemSnapshot = {
    fetchedAt,
    date: fetchedAt.slice(0, 10),
    license: "mixed — see per-signal license and attributionUrl fields",
    entities: ECOSYSTEM_ENTITIES,
    signals: fresh,
    scores: computeEcosystemScores(fresh, new Date(fetchedAt)),
  };
  await mkdir(HISTORY, { recursive: true });
  await writeFile(LATEST, JSON.stringify(snapshot));
  await writeFile(path.join(HISTORY, `${snapshot.date}.json`), JSON.stringify(snapshot));
  console.log(`[sync-ecosystem] wrote ${fresh.length} signals and ${snapshot.scores.length} scores`);
}

main().catch((error) => { console.error("[sync-ecosystem] failed:", error); process.exit(1); });
