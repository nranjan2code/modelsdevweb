import { createHash } from "node:crypto";
import type { Change, Event, EventType, Listing } from "./types";

function comparable(l: Listing): Record<string, unknown> {
  return {
    name: l.name,
    description: l.description,
    family: l.family,
    status: l.status,
    experimental: l.experimental,
    attachment: l.attachment,
    reasoning: l.reasoning,
    tool_call: l.toolCall,
    structured_output: l.structuredOutput,
    temperature: l.temperature,
    open_weights: l.openWeights,
    knowledge: l.knowledge,
    release_date: l.releaseDate,
    last_updated: l.lastUpdated,
    "modalities.input": l.modalities.input.join(","),
    "modalities.output": l.modalities.output.join(","),
    "limit.context": l.limit.context,
    "limit.output": l.limit.output,
    "limit.input": l.limit.input,
    "cost.input": l.cost.input,
    "cost.output": l.cost.output,
    "cost.cache_read": l.cost.cacheRead,
    "cost.cache_write": l.cost.cacheWrite,
    "cost.reasoning": l.cost.reasoning,
    "cost.input_audio": l.cost.inputAudio,
    "cost.output_audio": l.cost.outputAudio,
    "cost.tiers": l.cost.tiers,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || (a === null && b === null) || (JSON.stringify(a) === JSON.stringify(b));
}

export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): Change[] {
  const changes: Change[] = [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    const oldV = before[field] ?? null;
    const newV = after[field] ?? null;
    if (!sameValue(oldV, newV)) changes.push({ field, old: oldV, new: newV });
  }
  return changes;
}

const PRIORITY: EventType[] = [
  "deprecated",
  "repriced",
  "context_changed",
  "capability_changed",
  "provider_added",
  "model_added",
  "provider_removed",
  "model_removed",
];

export function classify(changes: Change[]): EventType {
  if (changes.some((c) => c.field === "status" && c.new === "deprecated")) return "deprecated";
  if (changes.some((c) => c.field.startsWith("cost."))) return "repriced";
  if (changes.some((c) => c.field.startsWith("limit."))) return "context_changed";
  return "capability_changed";
}

function makeEvent(date: string, type: EventType, listing: Listing, changes: Change[]): Event {
  const id = createHash("sha1").update(`${date}|${type}|${listing.key}`).digest("hex").slice(0, 12);
  return {
    id,
    type,
    date,
    modelKey: listing.key,
    modelName: listing.name,
    canonicalId: listing.canonicalId,
    labId: listing.canonicalId ? listing.canonicalId.split("/")[0] : null,
    providerId: listing.providerId,
    changes,
  };
}

export function sortEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const pa = PRIORITY.indexOf(a.type);
    const pb = PRIORITY.indexOf(b.type);
    if (pa !== pb) return pa - pb;
    return a.modelKey.localeCompare(b.modelKey);
  });
}

export function diffListings(prev: Listing[], next: Listing[], date: string): Event[] {
  const prevMap = new Map(prev.map((l) => [l.key, l]));
  const nextMap = new Map(next.map((l) => [l.key, l]));
  const prevProviders = new Set(prev.map((l) => l.providerId));
  const events: Event[] = [];
  const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  for (const key of keys) {
    const before = prevMap.get(key);
    const after = nextMap.get(key);
    if (!before && after) {
      // A listing appearing on an already-known provider is a new MODEL;
      // provider_added is reserved for providers entering the catalog wholesale.
      const type: EventType = prevProviders.has(after.providerId) ? "model_added" : "provider_added";
      events.push(makeEvent(date, type, after, []));
      continue;
    }
    if (before && !after) {
      events.push(makeEvent(date, "model_removed", before, []));
      continue;
    }
    if (!before || !after) continue;
    const changes = diffFields(comparable(before), comparable(after));
    if (changes.length === 0) continue;
    events.push(makeEvent(date, classify(changes), after, changes));
  }
  return sortEvents(events);
}
