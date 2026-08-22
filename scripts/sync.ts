import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffListings } from "../src/lib/pipeline/diff";
import { normalizeApi, normalizeModels } from "../src/lib/pipeline/normalize";
import { runQuality } from "../src/lib/pipeline/quality";
import type { Event } from "../src/lib/pipeline/types";
import type { ExternalSignalsSnapshot } from "../src/lib/pipeline/external-types";
import { pruneExternalSignals } from "../src/lib/pipeline/enrichment-hygiene";
import { rawApi, rawModels } from "../src/lib/pipeline/schema";
import { groupListings, groupToFacts } from "../src/lib/data";
import { appendDay, EMPTY_ARCHIVE, toObservations, type PriceArchive } from "../src/lib/data/archive";
import { getWeights } from "../src/lib/data/weights";

const ROOT = path.dirname(import.meta.dirname);
const SNAPSHOTS = path.join(ROOT, "snapshots");
const LATEST = path.join(SNAPSHOTS, "latest");
const EVENTS_FILE = path.join(ROOT, "events", "index.json");
const EXTERNAL_SIGNALS_FILE = path.join(LATEST, "external-signals.json");

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Full snapshots are only needed to diff against and to rebuild the archive if
 * it is ever lost — 30 days is generous for both. The permanent record lives in
 * snapshots/price-archive.json, which is never pruned.
 */
const RETENTION_DAYS = 30;

const ARCHIVE_PATH = path.join(SNAPSHOTS, "price-archive.json");

async function readArchive(): Promise<PriceArchive> {
  const raw = (await readJson(ARCHIVE_PATH)) as Partial<PriceArchive> | null;
  if (!raw || !Array.isArray(raw.dates)) return EMPTY_ARCHIVE;
  return { dates: raw.dates, models: raw.models ?? {} };
}

async function pruneOldSnapshots(): Promise<void> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const entries = await readdir(SNAPSHOTS);
  for (const name of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
    const ts = new Date(`${name}T00:00:00Z`).getTime();
    if (Number.isFinite(ts) && ts < cutoff) {
      await rm(path.join(SNAPSHOTS, name), { recursive: true, force: true });
      console.log(`[sync] pruned snapshot ${name}`);
    }
  }
}

async function main(): Promise<void> {
  const date = today();
  console.log(`[sync] ${date}: fetching models.dev`);
  const [apiRaw, modelsRaw] = await Promise.all([
    fetchJson("https://models.dev/api.json"),
    fetchJson("https://models.dev/models.json"),
  ]);
  const parsedModels = rawModels.parse(modelsRaw);
  const { models, index } = normalizeModels(parsedModels);
  const parsedApi = rawApi.parse(apiRaw);
  const next = normalizeApi(parsedApi, index);
  const fetchedAt = new Date().toISOString();

  let newEvents: Event[] = [];
  const prevRaw = await readJson(path.join(LATEST, "api.json"));
  if (prevRaw) {
    const prevModelsRaw = await readJson(path.join(LATEST, "models.json"));
    const prevIndex = prevModelsRaw ? normalizeModels(rawModels.parse(prevModelsRaw)).index : index;
    const prev = normalizeApi(rawApi.parse(prevRaw), prevIndex);
    newEvents = diffListings(prev.listings, next.listings, date);
  }

  // The gate must validate what will actually land: existing events plus the
  // freshly diffed candidates, checked against the candidate catalog.
  const existing = ((await readJson(EVENTS_FILE)) as Event[] | null) ?? [];
  const seen = new Set(existing.map((e) => e.id));
  const mergedUnpruned = [...newEvents.filter((e) => !seen.has(e.id)), ...existing].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1,
  );
  // Model pages surface per-model history, so retain generously — but bound
  // file growth: nothing on the site reads events older than 90 days.
  const pruneCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prunedCount = mergedUnpruned.filter((e) => e.date < pruneCutoff).length;
  if (prunedCount > 0) console.log(`[sync] pruning ${prunedCount} event(s) older than ${pruneCutoff}`);
  const merged = mergedUnpruned.filter((e) => e.date >= pruneCutoff);

  // Quality gates run on the freshly computed dataset BEFORE anything is written:
  // a red gate leaves the previous snapshot in place and fails the workflow.
  const canonicalById = new Map(models.map((m) => [m.id, m]));
  const canonicalLabs = new Set(models.map((m) => m.labId));
  const candidateGroups = groupListings(next.listings, canonicalById, canonicalLabs);

  let externalSignals: ExternalSignalsSnapshot["signals"] = [];
  try {
    const extBuf = await readFile(EXTERNAL_SIGNALS_FILE, "utf8");
    const extData = JSON.parse(extBuf) as Partial<ExternalSignalsSnapshot>;
    externalSignals = extData.signals ?? [];
  } catch {
    // No external signals file yet — that's OK for first run
  }
  // Enrichments run later in the workflow. Validate only records that still
  // belong to the candidate catalog so a legitimate model removal can land;
  // sync-external then purges those retained records before the final gate.
  externalSignals = pruneExternalSignals(
    externalSignals,
    new Set(candidateGroups.map((group) => group.id)),
  ).signals;

  // Licence facts are refreshed by their own daily job; the gate validates
  // whatever is currently committed so a bad record cannot sit on the site.
  const weights = Object.values((await getWeights()).models);

  const quality = runQuality({
    now: new Date(fetchedAt),
    snapshotDate: date,
    fetchedAt,
    apiRaw: parsedApi as Record<string, { models?: unknown }>,
    groups: candidateGroups.map(groupToFacts),
    stats: {
      providers: next.providers.length,
      listings: next.listings.length,
      models: candidateGroups.filter((g) => g.labKnown).length,
      catalogEntries: candidateGroups.length,
      labs: new Set(candidateGroups.filter((g) => g.labKnown).map((g) => g.labId)).size,
    },
    labIds: [...new Set(candidateGroups.filter((g) => g.labKnown).map((g) => g.labId))],
    canonicalLabs,
    canonicalIds: index,
    events: merged,
    news: [],
    externalSignals,
    weights,
    liveApiRaw: parsedApi as Record<string, { models?: unknown }>,
  });
  for (const issue of quality.warnings) console.log(`[sync] gate WARN [${issue.check}] ${issue.message}`);
  if (!quality.ok) {
    for (const issue of quality.errors) console.error(`[sync] gate FAIL [${issue.check}] ${issue.message}`);
    console.error(`[sync] ${quality.errors.length} quality gate(s) failed — snapshot not written`);
    process.exit(1);
  }
  console.log(`[sync] quality gates passed (${quality.warnings.length} warning(s))`);

  // The permanent record. Written before the prune so a day is archived even if
  // its full snapshot is later aged out.
  const archive = appendDay(await readArchive(), date, toObservations(candidateGroups));
  await writeFile(ARCHIVE_PATH, JSON.stringify(archive));
  console.log(`[sync] archive: ${archive.dates.length} day(s), ${Object.keys(archive.models).length} models`);

  for (const dir of [LATEST, path.join(SNAPSHOTS, date)]) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "api.json"), JSON.stringify(apiRaw));
    await writeFile(path.join(dir, "models.json"), JSON.stringify(modelsRaw));
  }
  await writeFile(
    path.join(LATEST, "meta.json"),
    JSON.stringify({ date, fetchedAt }),
  );
  await pruneOldSnapshots();

  await mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await writeFile(EVENTS_FILE, JSON.stringify(merged));

  console.log(
    `[sync] providers=${next.providers.length} listings=${next.listings.length} canonical=${models.length} newEvents=${newEvents.length}`,
  );
}

main().catch((err) => {
  console.error("[sync] failed:", err);
  process.exit(1);
});
