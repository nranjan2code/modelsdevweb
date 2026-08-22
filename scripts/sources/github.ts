import type { ModelGroup } from "../../src/lib/data";
import type { ExternalSignal } from "../../src/lib/pipeline/external-types";
import { resolveExternalIds, type ExternalCandidate } from "../../src/lib/pipeline/external-resolver";

const GITHUB_API = "https://api.github.com";

/** Verified-existing repos (checked 2026-08). Fetch failures degrade silently. */
const KNOWN_MODEL_REPOS = [
  "meta-llama/llama3",
  "facebookresearch/llama",
  "mistralai/mistral-src",
  "QwenLM/Qwen2.5",
  "QwenLM/Qwen3",
  "google-deepmind/gemma",
  "deepseek-ai/DeepSeek-V2",
  "zai-org/GLM-4.5",
  "moonshotai/Kimi-K2",
  "allenai/OLMo",
  "EleutherAI/gpt-neox",
  "stability-ai/stablelm",
] as const;

interface GitHubRepo {
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  html_url: string;
}

async function fetchRepo(fullName: string, token?: string): Promise<GitHubRepo | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${GITHUB_API}/repos/${fullName}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) return null;
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      console.warn("[github] rate limited — set GITHUB_TOKEN to raise the limit");
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as GitHubRepo;
  } catch (err) {
    console.warn(`[github] ${fullName} fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchGitHubSignals(groups: ModelGroup[]): Promise<ExternalSignal[]> {
  const token = process.env.GITHUB_TOKEN;
  const fetchedAt = new Date().toISOString();
  const signals: ExternalSignal[] = [];

  const repos: GitHubRepo[] = [];
  for (const fullName of KNOWN_MODEL_REPOS) {
    const repo = await fetchRepo(fullName, token);
    if (repo) repos.push(repo);
    await new Promise((r) => setTimeout(r, 150));
  }

  const candidates: ExternalCandidate[] = repos.map((r) => ({ id: r.full_name, name: r.full_name }));
  const mappings = resolveExternalIds("github", candidates, groups);

  for (const repo of repos) {
    const mapping = mappings.find((m) => m.externalId.toLowerCase() === repo.full_name.toLowerCase());
    if (!mapping || mapping.confidence < 0.75) continue;

    const base = {
      source: "github" as const,
      modelId: mapping.groupId,
      fetchedAt,
      license: "repository metadata via GitHub API",
      attributionUrl: repo.html_url,
    };

    if (repo.stargazers_count > 0) {
      signals.push({
        ...base,
        signalType: "stars",
        value: repo.stargazers_count,
        metadata: { repo: repo.full_name, pushedAt: repo.pushed_at },
      });
    }
    if (repo.forks_count > 0) {
      signals.push({ ...base, signalType: "forks", value: repo.forks_count, metadata: { repo: repo.full_name } });
    }
  }

  return signals;
}