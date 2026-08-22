/**
 * Refresh open-weight licence and access facts from Hugging Face.
 *
 * Runs separately from `sync-external` because it is per-repo rather than
 * batched, and because licence terms change far more slowly than download
 * counts — daily is plenty. On any failure the previous file is kept: stale
 * licence data is much safer than none, since the pages that consume it are
 * telling people what they may legally ship.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/data";
import { EMPTY_WEIGHTS, type WeightsFacts, type WeightsSnapshot } from "../src/lib/data/weights";
import { fetchWeightsFacts } from "./sources/hf-weights";

const ROOT = path.dirname(import.meta.dirname);
const WEIGHTS_FILE = path.join(ROOT, "snapshots", "latest", "weights.json");

async function readExisting(): Promise<WeightsSnapshot> {
  try {
    return JSON.parse(await readFile(WEIGHTS_FILE, "utf8")) as WeightsSnapshot;
  } catch {
    return EMPTY_WEIGHTS;
  }
}

/**
 * Licences change on the order of months, and a full pass is ~140 requests, so
 * this runs once a day even though the workflow fires hourly.
 */
const REFRESH_INTERVAL_HOURS = 20;

function isFresh(snapshot: WeightsSnapshot): boolean {
  const ts = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < REFRESH_INTERVAL_HOURS * 3_600_000;
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const existing = await readExisting();
  if (!force && isFresh(existing)) {
    console.log(
      `[sync-weights] last refresh was under ${REFRESH_INTERVAL_HOURS}h ago — skipping (use --force to override)`,
    );
    return;
  }

  const catalog = await getCatalog();

  let fresh: WeightsFacts[] = [];
  let rejected: string[] = [];
  try {
    const result = await fetchWeightsFacts(catalog.tracked);
    fresh = result.facts;
    rejected = result.rejected;
  } catch (err) {
    console.warn("[sync-weights] fetch failed:", err instanceof Error ? err.message : err);
  }

  if (fresh.length === 0) {
    console.warn("[sync-weights] no facts fetched — keeping previous file");
    return;
  }

  // Merge rather than replace: a repo that failed to resolve this run keeps its
  // last known licence instead of silently losing it from the site.
  const models = { ...existing.models };
  for (const f of fresh) models[f.groupId] = f;
  // Records we actively disproved must go, though — keeping a stored one would
  // preserve the wrong licence this run just caught.
  for (const groupId of rejected) delete models[groupId];

  const snapshot: WeightsSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "https://huggingface.co — model card metadata, per-model card URL on each record",
    models,
  };

  await mkdir(path.dirname(WEIGHTS_FILE), { recursive: true });
  await writeFile(WEIGHTS_FILE, JSON.stringify(snapshot));
  console.log(
    `[sync-weights] wrote ${Object.keys(models).length} model(s) ` +
      `(${fresh.length} refreshed, ${rejected.length} purged as mis-resolved)`,
  );
}

main().catch((err) => {
  console.error("[sync-weights] failed:", err);
  process.exit(1);
});
