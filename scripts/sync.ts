import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffListings } from "../src/lib/pipeline/diff";
import { normalizeApi, normalizeModels } from "../src/lib/pipeline/normalize";
import type { Event } from "../src/lib/pipeline/types";
import { rawApi, rawModels } from "../src/lib/pipeline/schema";

const ROOT = path.dirname(import.meta.dirname);
const SNAPSHOTS = path.join(ROOT, "snapshots");
const LATEST = path.join(SNAPSHOTS, "latest");
const EVENTS_FILE = path.join(ROOT, "events", "index.json");

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

const RETENTION_DAYS = 14;

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

  let newEvents: Event[] = [];
  const prevRaw = await readJson(path.join(LATEST, "api.json"));
  if (prevRaw) {
    const prevModelsRaw = await readJson(path.join(LATEST, "models.json"));
    const prevIndex = prevModelsRaw ? normalizeModels(rawModels.parse(prevModelsRaw)).index : index;
    const prev = normalizeApi(rawApi.parse(prevRaw), prevIndex);
    newEvents = diffListings(prev.listings, next.listings, date);
  }

  for (const dir of [LATEST, path.join(SNAPSHOTS, date)]) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "api.json"), JSON.stringify(apiRaw));
    await writeFile(path.join(dir, "models.json"), JSON.stringify(modelsRaw));
  }
  await writeFile(
    path.join(LATEST, "meta.json"),
    JSON.stringify({ date, fetchedAt: new Date().toISOString() }),
  );
  await pruneOldSnapshots();

  const existing = ((await readJson(EVENTS_FILE)) as Event[] | null) ?? [];
  const seen = new Set(existing.map((e) => e.id));
  const merged = [...newEvents.filter((e) => !seen.has(e.id)), ...existing].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1,
  );
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
