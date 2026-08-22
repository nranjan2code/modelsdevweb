import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/data";
import type { ModelGroup } from "../src/lib/data";
import type { Event, NewsItem } from "../src/lib/pipeline/types";

const ROOT = path.dirname(import.meta.dirname);
const NEWS_FILE = path.join(ROOT, "news", "index.json");
const EVENTS_FILE = path.join(ROOT, "events", "index.json");
const EXTERNAL_FILE = path.join(ROOT, "snapshots", "latest", "external-signals.json");
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_ITEMS = 24;
const MAX_QUERIES = 12;
/** Minimum hours between fetches; the hourly cron naturally yields ~6 runs/day. */
const MIN_INTERVAL_HOURS = Number(process.env.NEWS_MIN_INTERVAL_H ?? 4);
/** Items older than this drop out of the feed entirely. */
const ITEM_MAX_AGE_DAYS = 7;
/** Recency half-life used by the relevance score. */
const RECENCY_HALF_LIFE_HOURS = 48;

async function loadEnvFile(): Promise<void> {
  if (process.env.TAVILY_API_KEY) return;
  try {
    const buf = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of buf.split("\n")) {
      const m = line.match(/^\s*TAVILY_API_KEY\s*=\s*(.+)\s*$/);
      if (m) {
        process.env.TAVILY_API_KEY = m[1].trim();
        return;
      }
    }
  } catch {
    // no .env.local — rely on real env
  }
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  favicon?: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBack(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url;
  }
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 10).join(" ");
}

function digest(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tavilyNews(
  key: string,
  query: string,
  sinceDays: number,
): Promise<{ results: TavilyResult[]; credits: number }> {
  const body = JSON.stringify({
    query,
    topic: "news",
    start_date: daysBack(sinceDays),
    max_results: 5,
    search_depth: "basic",
    include_favicon: true,
    include_usage: true,
  });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        results?: TavilyResult[];
        usage?: { credits?: number };
      };
      return { results: data.results ?? [], credits: data.usage?.credits ?? 1 };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    throw new Error(`tavily -> HTTP ${res.status}`);
  }
}

/* ── Topic selection ────────────────────────────────────────────────────────
 * The models most likely to HAVE news right now are the ones already moving
 * in our own data: recent launches and repricings first, then momentum leaders
 * from external signals, then freshest canonical releases. Generic verticals
 * (releases, price cuts) catch stories about models we don't track yet.
 * ─────────────────────────────────────────────────────────────────────────── */

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function recentlyActiveModels(events: Event[], groups: Map<string, ModelGroup>, days: number): string[] {
  const cutoff = Date.now() - days * 86_400_000;
  const score = new Map<string, number>();
  for (const e of events) {
    const ts = Date.parse(`${e.date}T00:00:00Z`);
    if (!Number.isFinite(ts) || ts < cutoff || !e.canonicalId) continue;
    const weight = e.type === "model_added" ? 3 : e.type === "repriced" ? 2.5 : e.type === "context_changed" ? 1 : 0.5;
    const ageDays = (Date.now() - ts) / 86_400_000;
    score.set(e.canonicalId, (score.get(e.canonicalId) ?? 0) + weight * Math.pow(0.5, ageDays / 3));
  }
  return [...score.entries()]
    .filter(([id]) => groups.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

async function momentumModels(): Promise<Array<{ groupId: string; score: number }>> {
  const snap = await readJson<{ compositeScores?: Array<{ groupId: string; score: number }> }>(EXTERNAL_FILE);
  return snap?.compositeScores?.slice(0, 8).map((s) => ({ groupId: s.groupId, score: s.score })) ?? [];
}

interface QueryPlan {
  query: string;
  sinceDays: number;
  groupId: string | null;
}

async function buildQueryPlan(groups: ModelGroup[]): Promise<QueryPlan[]> {
  const events = (await readJson<Event[]>(EVENTS_FILE)) ?? [];
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const queries: QueryPlan[] = [];
  const seen = new Set<string>();

  for (const id of recentlyActiveModels(events, groupById, 7).slice(0, 5)) {
    const g = groupById.get(id)!;
    seen.add(id);
    queries.push({ query: `${g.name} AI model`, sinceDays: 4, groupId: g.id });
  }

  for (const m of await momentumModels()) {
    if (seen.has(m.groupId) || !groupById.has(m.groupId)) continue;
    seen.add(m.groupId);
    const g = groupById.get(m.groupId)!;
    queries.push({ query: `${g.name} AI`, sinceDays: 5, groupId: g.id });
  }

  const freshest = [...groups]
    .filter((g) => g.canonical?.releaseDate && !seen.has(g.id))
    .sort((a, b) => (b.canonical?.releaseDate ?? "").localeCompare(a.canonical?.releaseDate ?? ""))
    .slice(0, 3);
  for (const g of freshest) {
    seen.add(g.id);
    queries.push({ query: `${g.name} AI model`, sinceDays: 5, groupId: g.id });
  }

  queries.push(
    { query: "new AI model release announcement", sinceDays: 3, groupId: null },
    { query: "AI API price cut cheaper tokens", sinceDays: 3, groupId: null },
    { query: "large language model deprecation shutdown", sinceDays: 5, groupId: null },
  );

  return queries.slice(0, MAX_QUERIES);
}

/* ── Relevance scoring ──────────────────────────────────────────────────────
 * Blends four signals into one 0-100 rank that orders the feed everywhere:
 *   0.40 × editorial source weight (known outlets outrank aggregators)
 *   0.25 × recency (exp decay, 48h half-life — stale items sink)
 *   0.20 × our-vertical keyword match in title/snippet (pricing, launches…)
 *   0.15 × model linkage (tagged to a tracked model = on-topic by definition)
 * ─────────────────────────────────────────────────────────────────────────── */

const SOURCE_WEIGHTS: Array<[RegExp, number]> = [
  [/(^|\.)(techcrunch|arstechnica|theverge|wired|venturebeat|engadget)\./, 1],
  [/(^|\.)(reuters|bloomberg|ft\.com|wsj|cnbc|economist|ft|businessinsider|fortune)\./, 0.95],
  [/(^|\.)(theinformation|semianalysis|simonwillison|lilianweng|interconnects|epochai)\./, 0.95],
  [/(^|\.)(huggingface|openai|anthropic|deepmind|meta|qwen|mistral|xai)\./, 0.85],
  [/(^|\.)(zdnet|infoworld|computerworld|theregister|tomshardware|devclass)\./, 0.8],
  [/(^|\.)(medium|substack|dev\.to|hackernoon|towards\w+)\./, 0.55],
];

function sourceWeight(host: string): number {
  for (const [re, w] of SOURCE_WEIGHTS) if (re.test(host)) return w;
  return 0.45;
}

const VERTICAL_TERMS: Array<[RegExp, number]> = [
  [/pric(e|ing)|cheaper|cost|\$\d|per[- ]million|\/m\b/i, 1],
  [/\blaunch(es|ed)?\b|\brelease[sd]?\b|\bunveil|\bdebuts?\b|\brolls out\b/i, 0.9],
  [/context window|\btokens?\b/i, 0.6],
  [/benchmark|\bscores?\b|\belo\b|\barenas?\b/i, 0.6],
  [/deprecat|sunset|retir(e|ing)|shut ?down|discontinu/i, 0.8],
];

function verticalMatch(item: Pick<NewsItem, "title" | "snippet">): number {
  const text = `${item.title} ${item.snippet.slice(0, 400)}`;
  let best = 0;
  for (const [re, w] of VERTICAL_TERMS) if (re.test(text)) best = Math.max(best, w);
  return best;
}

function publishedMs(publishedAt: string | null): number | null {
  if (!publishedAt) return null;
  const t = Date.parse(publishedAt);
  return Number.isFinite(t) ? t : null;
}

export function relevanceScore(
  item: Pick<NewsItem, "title" | "snippet" | "source" | "publishedAt" | "modelIds">,
  now: number = Date.now(),
): number {
  const host = item.source.replace(/^www\./, "");
  const sw = sourceWeight(host);

  const pub = publishedMs(item.publishedAt);
  const ageH = pub != null ? Math.max(0, (now - pub) / 3_600_000) : 72;
  const recency = Math.pow(0.5, ageH / RECENCY_HALF_LIFE_HOURS);

  const vm = verticalMatch(item);
  const mm = item.modelIds.length > 0 ? 1 : 0;

  return Math.round((0.4 * sw + 0.25 * recency + 0.2 * vm + 0.15 * mm) * 100);
}

function pruneAndRescore(items: NewsItem[], now: number = Date.now()): NewsItem[] {
  const cutoff = now - ITEM_MAX_AGE_DAYS * 86_400_000;
  return items
    .filter((i) => {
      // Undated items stay (recency scoring already demotes them to ~0.35).
      const pub = publishedMs(i.publishedAt);
      return pub == null || pub >= cutoff;
    })
    .map((i) => ({ ...i, score: relevanceScore(i, now) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function enforceSourceDiversity(items: NewsItem[], perHostCap = 2): NewsItem[] {
  const counts = new Map<string, number>();
  const out: NewsItem[] = [];
  for (const i of items) {
    const c = counts.get(i.source) ?? 0;
    if (c >= perHostCap) continue;
    counts.set(i.source, c + 1);
    out.push(i);
  }
  return out;
}

async function main(): Promise<void> {
  await loadEnvFile();
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("[news] TAVILY_API_KEY not set — skipping news fetch");
    return;
  }

  const force = process.argv.includes("--force");
  interface PrevPayload {
    fetchedAt?: string;
    date?: string;
    items?: NewsItem[];
  }
  let prevItems: NewsItem[] = [];
  try {
    const prev = JSON.parse(await readFile(NEWS_FILE, "utf8")) as PrevPayload;
    // --force = clean rebuild: ignore both the interval gate AND stale merges.
    if (!force) prevItems = prev.items ?? [];
    if (!force && prev.fetchedAt) {
      const ageH = (Date.now() - new Date(prev.fetchedAt).getTime()) / 3_600_000;
      if (Number.isFinite(ageH) && ageH < MIN_INTERVAL_HOURS) {
        console.log(`[news] last fetch ${ageH.toFixed(1)}h ago (< ${MIN_INTERVAL_HOURS}h) — skipping`);
        return;
      }
    }
  } catch {
    // no previous file — proceed
  }

  const catalog = await getCatalog();
  const queries = await buildQueryPlan(catalog.groups);

  // Previous items participate in ranking so the feed evolves continuously
  // instead of being replaced wholesale every run.
  const byUrl = new Map<string, NewsItem>();
  const byTitle = new Map<string, NewsItem>();
  const addOrMerge = (item: NewsItem): void => {
    const normKey = normalizeUrl(item.url);
    const tKey = titleKey(item.title);
    const existing = byUrl.get(normKey) ?? (tKey ? byTitle.get(tKey) : undefined);
    if (existing) {
      for (const mid of item.modelIds) if (!existing.modelIds.includes(mid)) existing.modelIds.push(mid);
      for (const lid of item.labIds) if (!existing.labIds.includes(lid)) existing.labIds.push(lid);
      if (!existing.favicon && item.favicon) existing.favicon = item.favicon;
      return;
    }
    byUrl.set(normKey, item);
    if (tKey) byTitle.set(tKey, item);
  };
  for (const old of prevItems) addOrMerge(old);

  let failures = 0;
  let credits = 0;
  const mentionsModel = (text: string, g: ModelGroup | null): boolean => {
    if (!g) return false;
    const hay = `${text}`.toLowerCase();
    if (hay.includes(g.name.toLowerCase())) return true;
    // "GPT-5.6 Sol" vs "gpt5.6sol" style squashing — compare alnum-only forms.
    const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return squash(hay).includes(squash(g.name));
  };
  for (const q of queries) {
    try {
      const { results, credits: used } = await tavilyNews(key, q.query, q.sinceDays);
      credits += used;
      const group: ModelGroup | null = q.groupId ? (catalog.groupById.get(q.groupId) ?? null) : null;
      for (const r of results) {
        // Only tag a model when the article actually mentions it — query
        // provenance alone would tag every tangential hit under that model.
        const tagged = mentionsModel(`${r.title} ${r.content.slice(0, 500)}`, group);
        const norm = normalizeUrl(r.url);
        const existing = byUrl.get(norm);
        if (existing) {
          if (tagged && !existing.modelIds.includes(group!.id)) existing.modelIds.push(group!.id);
          continue;
        }
        addOrMerge({
          id: digest(norm),
          title: r.title,
          url: r.url,
          source: new URL(r.url).hostname.replace(/^www\./, ""),
          favicon: r.favicon ?? null,
          publishedAt: r.published_date ?? null,
          score: r.score,
          snippet: r.content,
          modelIds: tagged && group ? [group.id] : [],
          labIds: tagged && group ? [group.labId] : [],
        });
      }
      console.log(`[news] "${q.query}" -> ${results.length} results`);
    } catch (err) {
      failures++;
      console.warn(`[news] query failed: "${q.query}":`, err instanceof Error ? err.message : err);
    }
    await sleep(300);
  }

  if (failures === queries.length) {
    throw new Error("[news] all Tavily queries failed — keeping previous news file");
  }

  const merged = [...byUrl.values()];
  const items = enforceSourceDiversity(pruneAndRescore(merged)).slice(0, MAX_ITEMS);
  const payload = { fetchedAt: new Date().toISOString(), date: today(), items };
  await mkdir(path.dirname(NEWS_FILE), { recursive: true });
  await writeFile(NEWS_FILE, JSON.stringify(payload));
  console.log(
    `[news] wrote ${items.length} items (${queries.length - failures}/${queries.length} queries ok, ` +
      `${credits} credits, ${merged.length - items.length} pruned/deduped)`,
  );
}

main().catch((err) => {
  console.error("[news] failed:", err);
  process.exit(1);
});