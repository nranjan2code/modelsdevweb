import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog, type ModelGroup } from "../src/lib/data";
import type { Provider } from "../src/lib/pipeline/types";
import type { VerifiedOffer } from "../src/lib/pipeline/types";

const ROOT = path.dirname(import.meta.dirname);
const FILE = path.join(ROOT, "offers", "index.json");
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_QUERIES = 12;
const MIN_INTERVAL_HOURS = Number(process.env.OFFERS_MIN_INTERVAL_H ?? 48);
const FREE_TERMS = /\bfree\b|no[- ]cost|complimentary|free credits?|free tier/i;
const CAMPAIGN_TERMS = /limited[- ]time|ends? on|until|through|promo|promotion|campaign|introductory|while supplies last|for \d+ days?/i;

interface TavilyResult { title: string; url: string; content: string; published_date?: string; }
interface Stored { fetchedAt?: string; offers?: VerifiedOffer[]; }

async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return null; }
}

function digest(s: string): string {
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function sourceHosts(providers: Provider[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const p of providers) {
    const hosts = new Set<string>();
    for (const url of [p.doc, p.api]) { const host = url ? hostOf(url) : null; if (host) hosts.add(host); }
    out.set(p.id, hosts);
  }
  return out;
}

function groupFor(text: string, groups: ModelGroup[]): ModelGroup | null {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hay = squash(text);
  return groups
    .filter((g) => hay.includes(squash(g.name)))
    .sort((a, b) => b.name.length - a.name.length)[0] ?? null;
}

function providerFor(url: string, group: ModelGroup, hosts: Map<string, Set<string>>): string | null {
  const host = hostOf(url); if (!host) return null;
  return group.listings.find((l) => hosts.get(l.providerId)?.has(host))?.providerId ?? null;
}

async function search(key: string, query: string): Promise<TavilyResult[]> {
  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ query, topic: "general", search_depth: "advanced", max_results: 5, include_raw_content: true }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  return ((await res.json()) as { results?: TavilyResult[] }).results ?? [];
}

async function verify(url: string): Promise<string | null> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "model-pulse-offer-check/1.0" } });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/html") && !type.includes("text/plain")) return null;
  return (await res.text()).replace(/\s+/g, " ").slice(0, 120_000);
}

function dates(text: string): { startsOn: string | null; expiresOn: string | null } {
  const iso = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
  return { startsOn: iso[0] ?? null, expiresOn: iso[1] ?? null };
}

async function main(): Promise<void> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) { console.warn("[offers] TAVILY_API_KEY not set — keeping last verified offers"); return; }
  const stored = await readJson<Stored>(FILE);
  if (stored?.fetchedAt) {
    const ageH = (Date.now() - Date.parse(stored.fetchedAt)) / 3_600_000;
    if (Number.isFinite(ageH) && ageH < MIN_INTERVAL_HOURS) {
      console.log(`[offers] last fetch ${ageH.toFixed(1)}h ago (< ${MIN_INTERVAL_HOURS}h) — skipping fetch`);
      return;
    }
  }
  const catalog = await getCatalog();
  const hosts = sourceHosts(catalog.providers);
  const recent = [...catalog.groups]
    .filter((g) => g.listings.some((l) => l.releaseDate && Date.now() - Date.parse(l.releaseDate) <= 14 * 86_400_000))
    .sort((a, b) => a.name.localeCompare(b.name));
  const targets = [...new Map([...recent, ...catalog.tracked].map((g) => [g.id, g])).values()].slice(0, 8);
  const queries = [
    ...targets.map((g) => `${g.name} API free limited time offer`),
    "AI API model free limited time promotion ends",
    "AI model free credits new offer until",
  ].slice(0, MAX_QUERIES);
  const found: VerifiedOffer[] = [];
  for (const query of queries) {
    try {
      for (const result of await search(key, query)) {
        const group = groupFor(`${result.title} ${result.content}`, catalog.groups);
        const host = hostOf(result.url);
        if (!group || !host || !FREE_TERMS.test(`${result.title} ${result.content}`) || !CAMPAIGN_TERMS.test(`${result.title} ${result.content}`)) continue;
        const providerId = providerFor(result.url, group, hosts);
        if (!providerId) continue; // first-party provider docs/API host is mandatory
        const page = await verify(result.url);
        const evidence = page && FREE_TERMS.test(page) && CAMPAIGN_TERMS.test(page) ? page : null;
        if (!evidence) continue;
        const provider = catalog.providers.find((p) => p.id === providerId)!;
        const ds = dates(evidence);
        const offer: VerifiedOffer = {
          id: digest(`${group.id}:${providerId}:${result.url}`), modelId: group.id, modelName: group.name,
          providerId, providerName: provider.name, offer: result.title, startsOn: ds.startsOn, expiresOn: ds.expiresOn,
          sourceUrl: result.url, sourceHost: host, verifiedAt: new Date().toISOString(),
          evidence: evidence.slice(0, 500),
        };
        if (!found.some((x) => x.id === offer.id)) found.push(offer);
      }
    } catch (err) { console.warn(`[offers] query failed: ${query}`, err instanceof Error ? err.message : err); }
  }
  const previous = stored?.offers ?? [];
  const byId = new Map(previous.map((o) => [o.id, o]));
  for (const offer of found) byId.set(offer.id, offer);
  // Keep expired offers as an audit trail. They disappear from the hero via
  // freshOffer(), but the detail page must still answer “when did it end?”.
  const all = [...byId.values()].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify({ fetchedAt: new Date().toISOString(), offers: all }));
  console.log(`[offers] wrote ${found.length} reverified offer(s), ${all.length} total including expired history`);
}

main().catch((err) => { console.error("[offers] failed:", err); process.exit(1); });
