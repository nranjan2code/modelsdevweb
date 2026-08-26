import type { EcosystemEntity, EcosystemSignal } from "../../src/lib/ecosystem/types";

interface GitHubRepo {
  stargazers_count: number;
  forks_count: number;
  html_url: string;
}

interface NpmPoint {
  downloads: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    console.warn(`[ecosystem] ${url} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function fetchEcosystemSignals(entities: EcosystemEntity[], previous: EcosystemSignal[]): Promise<EcosystemSignal[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const previousByKey = new Map(previous.map((signal) => [`${signal.entityId}:${signal.source}:${signal.metric}`, signal]));
  const fetchedAt = new Date().toISOString();
  const signals: EcosystemSignal[] = [];
  const add = (entity: EcosystemEntity, source: EcosystemSignal["source"], metric: EcosystemSignal["metric"], value: number, attributionUrl: string): void => {
    if (!Number.isFinite(value) || value < 0) return;
    const old = previousByKey.get(`${entity.id}:${source}:${metric}`);
    signals.push({
      entityId: entity.id,
      source,
      metric,
      value,
      previousValue: old?.value ?? null,
      change: old ? value - old.value : null,
      fetchedAt,
      attributionUrl,
      license: source === "github" ? "repository metadata via GitHub API" : "download count via npm registry API",
    });
  };

  for (const entity of entities) {
    if (entity.repositoryUrl) {
      const repo = entity.repositoryUrl.replace("https://github.com/", "").replace(/\/$/, "");
      const data = await fetchJson<GitHubRepo>(`https://api.github.com/repos/${repo}`, headers);
      if (data) {
        add(entity, "github", "stars", data.stargazers_count, data.html_url);
        add(entity, "github", "forks", data.forks_count, data.html_url);
      }
      await sleep(150);
    }
    if (entity.npmPackage) {
      const data = await fetchJson<NpmPoint>(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(entity.npmPackage)}`);
      if (data) add(entity, "npm", "npm-weekly-downloads", data.downloads, `https://www.npmjs.com/package/${entity.npmPackage}`);
      await sleep(150);
    }
  }
  return signals;
}
