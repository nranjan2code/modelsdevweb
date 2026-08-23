/**
 * Instruments: the ~dozen things a buyer is actually choosing between.
 *
 * A catalog of 3,000 listings has no index because it has no constituents —
 * 75% of it is gateway variants and community re-uploads of the same weights.
 * An instrument is a *class of purchase* ("a frontier reasoning model", "a
 * cheap open 8B you could host"), and a buyer picks a class long before they
 * pick a ticker. Indices, baskets and cost-per-task all need this layer.
 *
 * Membership is derived from facts already verified elsewhere — the canonical
 * lab attribution, the price under a named workload, the context window, the
 * licence class from `weights.ts` — never from the model's name. Naming a
 * frontier model by string match is how "GPT-5.6 Sol Pro" and a reseller's
 * "gpt-5.6-sol (50% off)" end up in the same basket.
 */

import { groupContext, liveListings, type ModelGroup } from "../data/index";
import { isTokenComparable } from "./comparable";
import { DEFAULT_WORKLOAD, ratePerMillion, type Workload } from "./workload";

export interface Instrument {
  id: string;
  name: string;
  /** Printed under the basket so membership is never a black box. */
  rule: string;
}

interface InstrumentDef extends Instrument {
  match: (g: ModelGroup, ctx: MatchContext) => boolean;
}

export interface MatchContext {
  rate: number;
  context: number | null;
  /** Open weights with a licence permitting commercial use, per weights.ts. */
  freelyUsable: boolean;
  reasoning: boolean;
}


/**
 * Ordered: a group joins the first instrument it matches, so the classes stay
 * disjoint and a basket never double-counts a model.
 */
const DEFS: InstrumentDef[] = [
  {
    id: "open-hostable",
    name: "Open & hostable",
    rule: "Open weights under a commercially usable licence — the buy-or-host decision",
    match: (_g, c) => c.freelyUsable,
  },
  {
    id: "frontier-reasoning",
    name: "Frontier reasoning",
    rule: "Reasoning-capable, ≥200k context, above $2/M under the current workload",
    match: (_g, c) => c.reasoning && (c.context ?? 0) >= 200_000 && c.rate > 2,
  },
  {
    id: "frontier-general",
    name: "Frontier general",
    rule: "≥200k context, above $2/M, no reasoning mode",
    match: (_g, c) => !c.reasoning && (c.context ?? 0) >= 200_000 && c.rate > 2,
  },
  {
    id: "workhorse",
    name: "Workhorse",
    rule: "$0.30–$2/M with at least a 100k context — the default production choice",
    match: (_g, c) => c.rate >= 0.3 && c.rate <= 2 && (c.context ?? 0) >= 100_000,
  },
  {
    id: "budget",
    name: "Budget",
    rule: "Under $0.30/M — cheap enough that volume, not capability, decides",
    match: (_g, c) => c.rate > 0 && c.rate < 0.3,
  },
];

export const INSTRUMENTS: Instrument[] = DEFS.map((d) => ({ id: d.id, name: d.name, rule: d.rule }));

export interface Constituent {
  group: ModelGroup;
  rate: number;
}

export interface Basket {
  instrument: Instrument;
  constituents: Constituent[];
  /** Median effective rate across constituents — the basket's level. */
  median: number;
  cheapest: Constituent | null;
  dearest: Constituent | null;
}

/** Below this, the median is one or two models wearing an index's clothes. */
export const MIN_CONSTITUENTS = 4;

export function classify(
  g: ModelGroup,
  freelyUsable: Set<string>,
  w: Workload = DEFAULT_WORKLOAD,
): Instrument | null {
  const rate = ratePerMillion(g.best?.cost ?? { input: null, output: null, cacheRead: null, cacheWrite: null, reasoning: null, inputAudio: null, outputAudio: null, tiers: [] }, w);
  if (!Number.isFinite(rate)) return null;
  const ctx: MatchContext = {
    rate,
    context: groupContext(g),
    freelyUsable: freelyUsable.has(g.id),
    reasoning: g.canonical?.reasoning === true,
  };
  if (!isTokenComparable(g)) return null;
  const def = DEFS.find((d) => d.match(g, ctx));
  return def ? { id: def.id, name: def.name, rule: def.rule } : null;
}

/**
 * Baskets over `tracked` only, and only over models someone still serves.
 * Running this over `groups` would weight every class by how many resellers
 * happen to list a model; leaving retired models in would price a basket off
 * quotes nobody can transact at.
 */
export function buildBaskets(
  tracked: ModelGroup[],
  freelyUsable: Set<string>,
  w: Workload = DEFAULT_WORKLOAD,
): Basket[] {
  const byInstrument = new Map<string, Constituent[]>();
  for (const g of tracked) {
    if (liveListings(g).length === 0) continue;
    const instrument = classify(g, freelyUsable, w);
    if (!instrument) continue;
    const rate = ratePerMillion(g.best!.cost, w);
    const arr = byInstrument.get(instrument.id);
    if (arr) arr.push({ group: g, rate });
    else byInstrument.set(instrument.id, [{ group: g, rate }]);
  }

  return INSTRUMENTS.flatMap((instrument) => {
    const constituents = (byInstrument.get(instrument.id) ?? []).sort((a, b) => a.rate - b.rate);
    if (constituents.length < MIN_CONSTITUENTS) return [];
    const rates = constituents.map((c) => c.rate);
    const mid = Math.floor(rates.length / 2);
    return [{
      instrument,
      constituents,
      median: rates.length % 2 === 1 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2,
      cheapest: constituents[0],
      dearest: constituents[constituents.length - 1],
    }];
  });
}
