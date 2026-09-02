import { readFile } from "node:fs/promises";
import path from "node:path";
import { getWeights } from "../src/lib/data/weights";
import { getCatalog, groupToFacts } from "../src/lib/data";
import { runQuality, type QualityInput, type QualityIssue } from "../src/lib/pipeline/quality";
import type { Event } from "../src/lib/pipeline/types";
import type { ExternalSignalsSnapshot } from "../src/lib/pipeline/external-types";
import type { VerifiedOffer } from "../src/lib/pipeline/types";

const ROOT = path.dirname(import.meta.dirname);
const LATEST = path.join(ROOT, "snapshots", "latest");

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

interface RawProvider {
  models?: unknown;
}

async function fetchLiveApi(): Promise<Record<string, RawProvider> | null> {
  try {
    const res = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, RawProvider>;
  } catch {
    return null;
  }
}

function printIssues(label: string, issues: QualityIssue[]): void {
  for (const issue of issues) {
    console.log(`${label} [${issue.check}] ${issue.message}`);
  }
}

function checkOffers(offers: VerifiedOffer[], catalog: Awaited<ReturnType<typeof getCatalog>>): QualityIssue[] {
  const out: QualityIssue[] = [];
  const ids = new Set(catalog.groups.map((g) => g.id));
  const providers = new Set(catalog.providers.map((p) => p.id));
  for (const offer of offers) {
    if (!ids.has(offer.modelId)) out.push({ check: "offers-integrity", message: `${offer.id} references unknown model ${offer.modelId}` });
    if (!providers.has(offer.providerId)) out.push({ check: "offers-integrity", message: `${offer.id} references unknown provider ${offer.providerId}` });
    if (!offer.sourceUrl || !offer.sourceHost || !/^https:\/\//.test(offer.sourceUrl)) out.push({ check: "offers-integrity", message: `${offer.id} has no HTTPS first-party source` });
    if (!offer.evidence || !/\bfree\b|no[- ]cost|free credits?/i.test(offer.evidence)) out.push({ check: "offers-integrity", message: `${offer.id} has no free-offer evidence` });
    if (!offer.verifiedAt || !Number.isFinite(Date.parse(offer.verifiedAt))) out.push({ check: "offers-integrity", message: `${offer.id} has invalid verification time` });
    if (offer.startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(offer.startsOn)) out.push({ check: "offers-integrity", message: `${offer.id} has invalid start date` });
    if (offer.expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(offer.expiresOn)) out.push({ check: "offers-integrity", message: `${offer.id} has invalid expiry date` });
  }
  return out;
}

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  console.log(`[gate] ${new Date().toISOString()} checking snapshots/latest${offline ? " (offline)" : ""}`);

  const catalog = await getCatalog();
  const apiRaw = await readJson<Record<string, RawProvider>>(path.join(LATEST, "api.json"));
  const meta = await readJson<{ date?: string; fetchedAt?: string }>(path.join(LATEST, "meta.json"));
  const events = (await readJson<Event[]>(path.join(ROOT, "events", "index.json"))) ?? [];
  const newsJson = await readJson<{ items?: QualityInput["news"]; fetchedAt?: string }>(path.join(ROOT, "news", "index.json"));
  const offersJson = await readJson<{ offers?: VerifiedOffer[] }>(path.join(ROOT, "offers", "index.json"));

  if (!apiRaw || !meta) {
    console.error("[gate] FAIL: snapshots/latest/api.json or meta.json unreadable");
    process.exit(1);
  }

  // Canonical labs/ids straight from the canonical models file.
  const canonicalIds = new Set<string>();
  const canonicalLabs = new Set<string>();
  try {
    const rawModels = (await JSON.parse(await readFile(path.join(LATEST, "models.json"), "utf8"))) as Record<string, Record<string, unknown>>;
    for (const [id, m] of Object.entries(rawModels)) {
      canonicalIds.add(id);
      canonicalLabs.add(String(id).split("/")[0]);
      void m;
    }
  } catch {
    console.error("[gate] FAIL: snapshots/latest/models.json unreadable");
    process.exit(1);
  }

  const liveApiRaw = offline ? null : await fetchLiveApi();
  if (!offline && liveApiRaw == null) {
    console.log("[gate] warn: live upstream fetch failed — upstream-completeness check skipped");
  }

  const external = await readJson<ExternalSignalsSnapshot>(path.join(LATEST, "external-signals.json"));

  const labIds = [...new Set(catalog.groups.filter((g) => g.labKnown).map((g) => g.labId))];
  const input: QualityInput = {
    now: new Date(),
    snapshotDate: meta.date ?? null,
    fetchedAt: meta.fetchedAt ?? null,
    apiRaw,
    groups: catalog.groups.map(groupToFacts),
    stats: {
      providers: catalog.stats.providers,
      listings: catalog.stats.listings,
      models: catalog.stats.models,
      activeModels: catalog.stats.activeModels,
      catalogEntries: catalog.stats.catalogEntries,
      labs: catalog.stats.labs,
    },
    labIds,
    canonicalLabs,
    canonicalIds,
    events,
    news: newsJson?.items ?? [],
    externalSignals: external?.signals ?? [],
    weights: Object.values((await getWeights()).models),
    liveApiRaw,
  };

  const result = runQuality(input);
  result.errors.push(...checkOffers(offersJson?.offers ?? [], catalog));
  printIssues("FAIL", result.errors);
  printIssues("WARN", result.warnings);

  console.log(
    `[gate] providers=${catalog.stats.providers} listings=${catalog.stats.listings} groups=${catalog.stats.models} labs=${catalog.stats.labs} · ` +
      `${result.errors.length} error(s), ${result.warnings.length} warning(s)` +
      (liveApiRaw ? " · compared against live upstream" : ""),
  );
  if (!result.ok) {
    console.error("[gate] FAILED — refusing to bless this dataset");
    process.exit(1);
  }
  console.log("[gate] OK");
}

main().catch((err) => {
  console.error("[gate] crashed:", err);
  process.exit(1);
});
