import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCatalog } from "../src/lib/data";
import type { ModelGroup } from "../src/lib/data";
import type { NewsItem } from "../src/lib/pipeline/types";

const ROOT = path.dirname(import.meta.dirname);
const NEWS_FILE = path.join(ROOT, "news", "index.json");
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_ITEMS = 24;
const MAX_QUERIES = 12;

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

function pickModels(groups: ModelGroup[]): ModelGroup[] {
  const freshest = [...groups]
    .filter((g) => g.canonical?.releaseDate)
    .sort((a, b) => (b.canonical?.releaseDate ?? "").localeCompare(a.canonical?.releaseDate ?? ""))
    .slice(0, 6);
  const picked = new Set(freshest.map((g) => g.id));
  const popular = [...groups]
    .filter((g) => !picked.has(g.id) && g.best)
    .sort((a, b) => b.listings.length - a.listings.length)
    .slice(0, 4);
  return [...freshest, ...popular];
}

async function main(): Promise<void> {
  await loadEnvFile();
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    console.warn("[news] TAVILY_API_KEY not set — skipping news fetch");
    return;
  }

  const force = process.argv.includes("--force");
  if (!force) {
    try {
      const prev = JSON.parse(await readFile(NEWS_FILE, "utf8")) as { date?: string };
      if (prev.date === today()) {
        console.log(`[news] already fetched today (${prev.date}) — skipping`);
        return;
      }
    } catch {
      // no previous file — proceed
    }
  }

  const catalog = await getCatalog();
  const models = pickModels(catalog.groups);
  const queries: { query: string; sinceDays: number; groupId: string | null }[] = models.map((g) => ({
    query: `${g.name} ${g.labId} AI model`,
    sinceDays: 3,
    groupId: g.id,
  }));
  queries.push(
    { query: "new large language model release", sinceDays: 2, groupId: null },
    { query: "AI model price cut announcement", sinceDays: 2, groupId: null },
  );
  queries.splice(MAX_QUERIES);

  const byUrl = new Map<string, NewsItem>();
  let failures = 0;
  let credits = 0;
  for (const q of queries) {
    try {
      const { results, credits: used } = await tavilyNews(key, q.query, q.sinceDays);
      credits += used;
      const group = q.groupId ? catalog.groupById.get(q.groupId) : null;
      for (const r of results) {
        const norm = normalizeUrl(r.url);
        const existing = byUrl.get(norm);
        if (existing) {
          if (group && !existing.modelIds.includes(group.id)) existing.modelIds.push(group.id);
          continue;
        }
        byUrl.set(norm, {
          id: digest(norm),
          title: r.title,
          url: r.url,
          source: new URL(r.url).hostname.replace(/^www\./, ""),
          favicon: r.favicon ?? null,
          publishedAt: r.published_date ?? null,
          score: r.score,
          snippet: r.content,
          modelIds: group ? [group.id] : [],
          labIds: group ? [group.labId] : [],
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

  const items = [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, MAX_ITEMS);
  const payload = { fetchedAt: new Date().toISOString(), date: today(), items };
  await mkdir(path.dirname(NEWS_FILE), { recursive: true });
  await writeFile(NEWS_FILE, JSON.stringify(payload));
  console.log(
    `[news] wrote ${items.length} items (${queries.length - failures}/${queries.length} queries ok, ${credits} credits)`,
  );
}

main().catch((err) => {
  console.error("[news] failed:", err);
  process.exit(1);
});
