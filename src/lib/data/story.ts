import type { Event } from "../pipeline/types";
import { blendPrice, groupContext, groupReleaseDate, type Catalog, type ModelGroup } from "./index";
import type { PricePoint } from "./history";
import { fmtDate, fmtPerM, fmtTokens } from "../format";

const DAY = 86_400_000;
const FRONTIER_CONTEXT = 200_000;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface LeadStory {
  kind: "cut" | "hike" | "launch" | "context" | "sunset" | "quiet" | "baseline";
  eyebrow: string;
  headline: string;
  dek: string;
  href: string;
  ctaLabel: string;
  meta: string[];
}

interface Candidate {
  score: number;
  story: LeadStory;
}

function pctCut(oldV: number, newV: number): number {
  return oldV > 0 ? 1 - newV / oldV : 0;
}

function pricedMeta(g: ModelGroup | null): string[] {
  return g?.best ? [`${fmtPerM(g.best.input)} /M input`] : [];
}

/**
 * The front-page lead. Deterministic at build time: candidates are scored
 * against the freshest event's date so the story only moves when the data does.
 */
export function leadStory(
  events: Event[],
  groupsById: Map<string, ModelGroup>,
  now: number = Date.now(),
): LeadStory {
  if (events.length === 0) {
    return {
      kind: "baseline",
      eyebrow: "Baseline",
      headline: "The baseline snapshot is captured.",
      dek: "The hourly sync diffs every provider listing against this point — releases, price moves and deprecations will surface here as they land.",
      href: "/changelog",
      ctaLabel: "Watch the changelog",
      meta: [],
    };
  }

  const newest = events.reduce((acc, e) => (e.date > acc ? e.date : acc), events[0].date);
  const cutoff48 = now - 36 * 3_600_000;

  const candidates: Candidate[] = [];
  const consider = (_e: Event, score: number, story: LeadStory) => {
    candidates.push({ score, story });
  };

  const cuts7d: { ratio: number; date: string }[] = [];
  for (const e of events) {
    const ts = Date.parse(`${e.date}T00:00:00Z`);
    if (!Number.isFinite(ts)) continue;
    for (const c of e.changes) {
      if (e.type === "repriced" && c.field === "cost.input" && typeof c.old === "number" && typeof c.new === "number") {
        if (c.new < c.old && ts >= now - 7 * DAY) cuts7d.push({ ratio: c.old / c.new, date: e.date });
      }
    }
  }
  const weekBestRatio = cuts7d.length > 0 ? Math.max(...cuts7d.map((c) => c.ratio)) : 0;

  const fresh = events.filter((e) => {
    const ts = Date.parse(`${e.date}T12:00:00Z`);
    return Number.isFinite(ts) && ts >= cutoff48;
  });

  for (const e of fresh) {
    const group = (e.canonicalId ? groupsById.get(e.canonicalId) : null) ?? null;
    const ctx = group ? groupContext(group) : null;
    const where = e.providerId ? ` via ${e.providerId}` : "";

    if (e.type === "repriced") {
      for (const c of e.changes) {
        if (c.field !== "cost.input" || typeof c.old !== "number" || typeof c.new !== "number") continue;
        const cut = c.new < c.old;
        const pctv = cut ? pctCut(c.old, c.new) : (c.new - c.old) / c.old;
        if (pctv < 0.02) continue;
        const isWeeksBest = cut && c.old / c.new >= weekBestRatio;
        const outChange = e.changes.find((o) => o.field === "cost.output");
        consider(
          e,
          (cut ? 1000 : 400) * pctv,
          {
            kind: cut ? "cut" : "hike",
            eyebrow: cut ? (isWeeksBest ? "Price watch · steepest cut of the week" : "Price watch") : "Price watch · hike",
            headline: `${e.modelName} ${cut ? "cuts" : "raises"} input price ${Math.round(pctv * 100)}%${where}`,
            dek: cut
              ? `Input drops ${fmtPerM(c.old)} → ${fmtPerM(c.new)} per 1M tokens${where}.${
                  isWeeksBest ? " The steepest repricing of the past seven days." : ""
                }${
                  outChange && typeof outChange.old === "number" && typeof outChange.new === "number"
                    ? ` Output moves ${fmtPerM(outChange.old)} → ${fmtPerM(outChange.new)} alongside.`
                    : ""
                }`
              : `Input climbs ${fmtPerM(c.old)} → ${fmtPerM(c.new)} per 1M tokens${where}. Worth checking cheaper routes on the model page.`,
href: e.canonicalId && groupsById.has(e.canonicalId) ? `/m/${e.canonicalId}` : "/changelog",
            ctaLabel: cut ? "See all its prices" : "Check the routes",
            meta: [
              `${fmtPerM(c.old)} → ${fmtPerM(c.new)} /M`,
              `${cut ? "−" : "+"}${Math.round(pctv * 100)}% input`,
              ...(ctx != null ? [`${fmtTokens(ctx)} context`] : []),
            ],
          },
        );
        break;
      }
      continue;
    }

    if (e.type === "model_added") {
      const priced = group?.best ?? null;
      const score =
        250 +
        (ctx != null && ctx >= 1_000_000 ? 150 : ctx != null && ctx >= FRONTIER_CONTEXT ? 80 : 0) +
        (group?.canonical?.benchmarks.length ? 30 : 0);
      consider(e, score, {
        kind: "launch",
        eyebrow: "New release",
        headline: `${group?.name ?? e.modelName} lands in the catalog${where}`,
        dek: priced
          ? `Cheapest listing today: ${fmtPerM(priced.input)} /M input, ${fmtPerM(priced.output)} /M output${where}${
              ctx != null ? `, with a ${fmtTokens(ctx)}-token context window` : ""
            }. Now tracked across all providers carrying it.`
          : `Listed${where}${ctx != null ? ` with ${fmtTokens(ctx)}-token context` : ""}; pricing not published yet.`,
        href: e.canonicalId && groupsById.has(e.canonicalId) ? `/m/${e.canonicalId}` : "/changelog",
        ctaLabel: "Open the model page",
        meta: [
          ...(priced ? [`${fmtPerM(priced.input)} / ${fmtPerM(priced.output)} per M`] : ["price TBD"]),
          ...(ctx != null ? [`${fmtTokens(ctx)} context`] : []),
          ...fresh.filter((o) => o.type === "model_added" && o.id !== e.id).length
            ? [`${fresh.filter((o) => o.type === "model_added").length} launches in 36h`]
            : [],
        ],
      });
      continue;
    }

    if (e.type === "context_changed") {
      const c = e.changes.find((o) => o.field === "limit.context");
      if (c && typeof c.old === "number" && typeof c.new === "number" && c.new > c.old && c.new >= 100_000) {
        consider(e, 200 * (c.new / c.old - 1), {
          kind: "context",
          eyebrow: "Context race",
          headline: `${e.modelName} stretches its context to ${fmtTokens(c.new)} tokens`,
          dek: `Up from ${fmtTokens(c.old)}${where}. Bigger windows usually mean repricing follows — watching.`,
href: e.canonicalId && groupsById.has(e.canonicalId) ? `/m/${e.canonicalId}` : "/changelog",
          ctaLabel: "See the model",
          meta: [`${fmtTokens(c.old)} → ${fmtTokens(c.new)}`, ...(pricedMeta(group))],
        });
      }
      continue;
    }

    if (e.type === "deprecated") {
      consider(e, 120, {
        kind: "sunset",
        eyebrow: "Sunset watch",
        headline: `${e.modelName} is being retired${where}`,
        dek: `Marked deprecated in today's diff. Migrations usually follow within weeks — alternatives live one click away.`,
        href: "/deprecations",
        ctaLabel: "Deprecations board",
        meta: [...(group?.best ? [`was ${fmtPerM(group.best.input)} /M`] : []), ...(ctx != null ? [`${fmtTokens(ctx)} context`] : [])],
      });
    }
  }

  const winner = candidates.reduce<Candidate | null>((acc, c) => (!acc || c.score > acc.score ? c : acc), null);
  if (winner) return winner.story;

  const lastTs = Date.parse(`${newest}T12:00:00Z`);
  const quietDays = Number.isFinite(lastTs) ? Math.max(0, Math.floor((now - lastTs) / DAY)) : 0;
  return {
    kind: "quiet",
    eyebrow: "Quiet tape",
    headline: `No moves in 36 hours — first lull in a while.`,
    dek: `Last detected change was ${quietDays <= 0 ? "today" : `${quietDays} day${quietDays === 1 ? "" : "s"} ago`}: ${
      events[0].type.replace("_", " ")
    } on ${events[0].modelName}. The hourly sync keeps watching.`,
    href: "/changelog",
    ctaLabel: "Full changelog",
    meta: [`last move ${fmtDate(newest)}`],
  };
}

export interface Mover {
  id: string | null;
  name: string;
  providerId: string | null;
  from: number;
  to: number;
  pct: number;
}

/** Net input-price change per model across a trailing window, from chained repricings. */
export function moversLosers(events: Event[], days = 7, now: number = Date.now()): { fallers: Mover[]; risers: Mover[] } {
  const cutoff = now - days * DAY;
  const chains = new Map<string, { name: string; id: string | null; providerId: string | null; from: number; to: number; date: string }>();
  const ordered = [...events].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1));
  for (const e of ordered) {
    const ts = Date.parse(`${e.date}T00:00:00Z`);
    if (!Number.isFinite(ts) || ts < cutoff || e.type !== "repriced") continue;
    for (const c of e.changes) {
      if (c.field !== "cost.input" || typeof c.old !== "number" || typeof c.new !== "number" || c.old === c.new) continue;
      const key = e.canonicalId ?? e.modelKey;
      const prev = chains.get(key);
      const from = prev?.from ?? c.old;
      chains.set(key, { name: e.modelName, id: e.canonicalId, providerId: e.providerId, from, to: c.new, date: e.date });
    }
  }
  const movers: Mover[] = [];
  for (const ch of chains.values()) {
    if (ch.from <= 0 || ch.from === ch.to) continue;
    movers.push({
      id: ch.id,
      name: ch.name,
      providerId: ch.providerId,
      from: ch.from,
      to: ch.to,
      pct: (ch.to - ch.from) / ch.from,
    });
  }
  const fallers = movers.filter((m) => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5);
  const risers = movers.filter((m) => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
  return { fallers, risers };
}

export interface RecordRow {
  title: string;
  id: string | null;
  holder: string;
  value: string;
  detail: string | null;
}

function dedupeByName(groups: ModelGroup[]): ModelGroup[] {
  const seen = new Set<string>();
  return groups.filter((g) => {
    const key = g.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Standing superlatives of the current catalog — evergreen linkable facts. */
export function records(catalog: Catalog): RecordRow[] {
  const rows: RecordRow[] = [];
  const live = (g: ModelGroup) => g.listings.filter((l) => l.status !== "deprecated").length;

  const longestCtx = dedupeByName(catalog.groups)
    .map((g) => ({ g, ctx: groupContext(g) }))
    .filter((x): x is { g: ModelGroup; ctx: number } => x.ctx != null)
    .sort((a, b) => b.ctx - a.ctx)[0];
  if (longestCtx) {
    rows.push({
      title: "Longest context window",
      id: longestCtx.g.id,
      holder: longestCtx.g.name,
      value: `${fmtTokens(longestCtx.ctx)} tokens`,
      detail: longestCtx.g.labKnown ? longestCtx.g.labId : null,
    });
  }

  const cheapestFrontier = dedupeByName(
    catalog.groups.filter((g) => g.best != null && !g.free && (groupContext(g) ?? 0) >= FRONTIER_CONTEXT),
  ).sort((a, b) => blendPrice(a.best!.input, a.best!.output) - blendPrice(b.best!.input, b.best!.output))[0];
  if (cheapestFrontier) {
    rows.push({
      title: "Cheapest frontier-grade (200K+ ctx)",
      id: cheapestFrontier.id,
      holder: cheapestFrontier.name,
      value: `${fmtPerM(blendPrice(cheapestFrontier.best!.input, cheapestFrontier.best!.output))} blended /M`,
      detail: cheapestFrontier.listings.length > 1 ? `${cheapestFrontier.listings.length} providers compete` : null,
    });
  }

  const widest = dedupeByName(catalog.groups).sort((a, b) => live(b) - live(a))[0];
  if (widest && live(widest) > 1) {
    rows.push({
      title: "Widest availability",
      id: widest.id,
      holder: widest.name,
      value: `${live(widest)} providers carry it`,
      detail: null,
    });
  }

  const openLongest = dedupeByName(catalog.groups.filter((g) => g.canonical?.openWeights === true))
    .map((g) => ({ g, ctx: groupContext(g) }))
    .filter((x): x is { g: ModelGroup; ctx: number } => x.ctx != null)
    .sort((a, b) => b.ctx - a.ctx)[0];
  if (openLongest) {
    rows.push({
      title: "Biggest open-weights context",
      id: openLongest.g.id,
      holder: openLongest.g.name,
      value: `${fmtTokens(openLongest.ctx)} tokens`,
      detail: "weights downloadable",
    });
  }

  const cheapestPaid = dedupeByName(catalog.groups.filter((g) => g.best != null && !g.free && g.best.input > 0))
    .sort((a, b) => a.best!.input - b.best!.input)[0];
  if (cheapestPaid) {
    rows.push({
      title: "Cheapest paid model",
      id: cheapestPaid.id,
      holder: cheapestPaid.name,
      value: `${fmtPerM(cheapestPaid.best!.input)} /M input`,
      detail: cheapestPaid.free ? "also has a free tier" : null,
    });
  }

  return rows;
}

const LAB_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google DeepMind",
  xai: "xAI",
  ai21: "AI21 Labs",
  minimax: "MiniMax",
  moonshotai: "Moonshot AI",
  deepseek: "DeepSeek",
  zai: "Z.ai",
  qwen: "Qwen",
  meta: "Meta AI",
  mistralai: "Mistral AI",
  microsoft: "Microsoft",
  nvidia: "NVIDIA",
  cohere: "Cohere",
};

export function labName(id: string): string {
  return LAB_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export interface LabScorecard {
  id: string;
  models: number;
  medianBlend: number | null;
  cheapestName: string | null;
  cheapestInput: number | null;
  lastRelease: string | null;
  openWeights: number;
  weeklyEvents: number;
}

/** Per-lab pulse: activity-weighted cards for the home rail. */
export function labScorecards(catalog: Catalog, events: Event[]): LabScorecard[] {
  const cutoff = Date.now() - 7 * DAY;
  const byLab = new Map<string, ModelGroup[]>();
  for (const g of catalog.groups) {
    if (!g.labKnown) continue;
    const arr = byLab.get(g.labId);
    if (arr) arr.push(g);
    else byLab.set(g.labId, [g]);
  }
  const eventCount = new Map<string, number>();
  for (const e of events) {
    if (!e.labId) continue;
    const ts = Date.parse(`${e.date}T00:00:00Z`);
    if (Number.isFinite(ts) && ts >= cutoff) eventCount.set(e.labId, (eventCount.get(e.labId) ?? 0) + 1);
  }

  const cards: LabScorecard[] = [];
  for (const [id, groups] of byLab) {
    const priced = dedupeByName(groups.filter((g) => g.best != null && !g.free));
    const cheapest = [...priced].sort((a, b) => a.best!.input - b.best!.input)[0] ?? null;
    const lastRelease = groups.reduce<string | null>((acc, g) => {
      const d = groupReleaseDate(g);
      return d && (!acc || d > acc) ? d : acc;
    }, null);
    cards.push({
      id,
      models: groups.length,
      medianBlend: median(priced.map((g) => blendPrice(g.best!.input, g.best!.output))),
      cheapestName: cheapest?.name ?? null,
      cheapestInput: cheapest?.best?.input ?? null,
      lastRelease,
      openWeights: groups.filter((g) => g.canonical?.openWeights === true).length,
      weeklyEvents: eventCount.get(id) ?? 0,
    });
  }
  return cards.sort((a, b) => b.weeklyEvents - a.weeklyEvents || b.models - a.models);
}

export interface Spotlight {
  id: string;
  name: string;
  labId: string;
  description: string | null;
  releaseDate: string | null;
  openWeights: boolean;
  topBenchmark: { name: string; score: number } | null;
}

/** Deterministic weekly pick — same model for everyone, rotates each ISO day-of-year block of 7. */
export function modelOfWeek(groups: ModelGroup[], now: Date = new Date()): Spotlight | null {
  const pool = dedupeByName(
    groups.filter(
      (g) =>
        g.best != null &&
        !g.free &&
        ((groupContext(g) ?? 0) >= FRONTIER_CONTEXT ||
          (g.canonical?.benchmarks?.length ?? 0) > 0 ||
          g.canonical?.reasoning === true),
    ),
  ).sort((a, b) => (groupReleaseDate(b) ?? "").localeCompare(groupReleaseDate(a) ?? "") || a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start) / DAY);
  const picked = pool[dayOfYear % pool.length];
  const bench = picked.canonical?.benchmarks != null ? [...picked.canonical.benchmarks].sort((a, b) => a.name.localeCompare(b.name))[0] : undefined;
  return {
    id: picked.id,
    name: picked.name,
    labId: picked.labId,
    description: picked.canonical?.description ?? null,
    releaseDate: groupReleaseDate(picked),
    openWeights: picked.canonical?.openWeights === true,
    topBenchmark: bench ? { name: bench.name, score: bench.score } : null,
  };
}

export interface PulsePoint {
  date: string;
  median: number;
  models: number;
}

/** Daily median blended price across frontier models — the site's signature index line. */
export function pulseSeries(history: Map<string, PricePoint[]>, frontierIds: Set<string>): PulsePoint[] {
  const byDate = new Map<string, number[]>();
  for (const [id, points] of history) {
    if (!frontierIds.has(id)) continue;
    for (const p of points) {
      if (p.input == null || p.output == null) continue;
      const arr = byDate.get(p.date);
      if (arr) arr.push(blendPrice(p.input, p.output));
      else byDate.set(p.date, [blendPrice(p.input, p.output)]);
    }
  }
  return [...byDate.entries()]
    .map(([date, nums]) => ({ date, median: median(nums) ?? 0, models: nums.length }))
    .filter((p) => p.median > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface HeadToHead {
  left: { id: string; name: string; labId: string; input: number; output: number; ctx: number | null };
  right: { id: string; name: string; labId: string; input: number; output: number; ctx: number | null };
}

/** Newest flagship per major lab, paired into rivalry teasers that deep-link into /compare. */
export function headToHeads(groups: ModelGroup[], catalogLabs: { id: string; modelCount: number }[]): HeadToHead[] {
  const flagshipOf = new Map<string, ModelGroup>();
  for (const lab of catalogLabs) {
    const flagship = groups
      .filter((g) => g.labId === lab.id && g.labKnown && g.best != null)
      .sort(
        (a, b) =>
          (groupReleaseDate(b) ?? "").localeCompare(groupReleaseDate(a) ?? "") ||
          (groupContext(b) ?? 0) - (groupContext(a) ?? 0),
      )[0];
    if (flagship) flagshipOf.set(lab.id, flagship);
  }
  const labs = [...flagshipOf.keys()].slice(0, 6);
  const pairs: HeadToHead[] = [];
  for (let i = 0; i + 1 < labs.length; i += 2) {
    const mk = (g: ModelGroup) => ({
      id: g.id,
      name: g.name,
      labId: g.labId,
      input: g.best!.input,
      output: g.best!.output,
      ctx: groupContext(g),
    });
    pairs.push({ left: mk(flagshipOf.get(labs[i])!), right: mk(flagshipOf.get(labs[i + 1])!) });
  }
  return pairs;
}

export interface DayCount {
  date: string;
  count: number;
}

/** Per-day event counts for the last `days` days, zero-filled, oldest first. */
export function activityCalendar(events: Event[], days = 14, now: number = Date.now()): DayCount[] {
  const todayStart = new Date(now).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
  const out: DayCount[] = [];
  const endTs = Date.parse(`${todayStart}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endTs - i * DAY).toISOString().slice(0, 10);
    out.push({ date: d, count: counts.get(d) ?? 0 });
  }
  return out;
}
