/**
 * Seed the permanent price archive from whatever daily snapshots survive on
 * disk. Run once when introducing the archive, and again after any incident
 * that loses it — the retained snapshots are the only source that can rebuild
 * it, and they age out at RETENTION_DAYS.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeApi, normalizeModels } from "../src/lib/pipeline/normalize";
import { rawApi, rawModels } from "../src/lib/pipeline/schema";
import { groupListings } from "../src/lib/data";
import { appendDay, EMPTY_ARCHIVE, toObservations, type PriceArchive } from "../src/lib/data/archive";


const ROOT = path.dirname(import.meta.dirname);
const SNAPSHOTS = path.join(ROOT, "snapshots");
const ARCHIVE_PATH = path.join(SNAPSHOTS, "price-archive.json");

async function main(): Promise<void> {
  const entries = await readdir(SNAPSHOTS);
  const days = entries.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  if (days.length === 0) {
    console.log("[backfill] no dated snapshots on disk — nothing to seed");
    return;
  }

  let archive: PriceArchive = EMPTY_ARCHIVE;
  try {
    const raw = JSON.parse(await readFile(ARCHIVE_PATH, "utf8")) as Partial<PriceArchive>;
    if (Array.isArray(raw.dates)) archive = { dates: raw.dates, models: raw.models ?? {} };
  } catch {
    // First run — start empty.
  }

  for (const date of days) {
    const dir = path.join(SNAPSHOTS, date);
    try {
      const [apiBuf, modelsBuf] = await Promise.all([
        readFile(path.join(dir, "api.json"), "utf8"),
        readFile(path.join(dir, "models.json"), "utf8"),
      ]);
      const { models, index } = normalizeModels(rawModels.parse(JSON.parse(modelsBuf)));
      const { listings } = normalizeApi(rawApi.parse(JSON.parse(apiBuf)), index);
      const groups = groupListings(
        listings,
        new Map(models.map((m) => [m.id, m])),
        new Set(models.map((m) => m.labId)),
      );
      const obs = toObservations(groups);
      archive = appendDay(archive, date, obs);
      console.log(`[backfill] ${date}: ${obs.length} models`);
    } catch (err) {
      console.warn(`[backfill] ${date}: skipped (${(err as Error).message})`);
    }
  }

  await writeFile(ARCHIVE_PATH, JSON.stringify(archive));
  console.log(
    `[backfill] archive now covers ${archive.dates.length} day(s), ${Object.keys(archive.models).length} models`,
  );
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
