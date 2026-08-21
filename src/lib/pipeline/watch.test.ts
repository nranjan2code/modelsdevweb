import { describe, expect, it } from "vitest";
import { selectEvents, type Watcher } from "./watch";
import type { Event } from "./types";

const ev = (id: string, type: string, labId: string | null): Event => ({
  id,
  type: type as Event["type"],
  date: "2026-08-21",
  modelKey: `${labId ?? "x"}/m`,
  modelName: "M",
  canonicalId: null,
  labId,
  providerId: null,
  changes: [],
});

const EVENTS = [
  ev("1", "repriced", "openai"),
  ev("2", "deprecated", "anthropic"),
  ev("3", "model_added", null),
];

describe("selectEvents", () => {
  it("skips already-notified events", () => {
    const out = selectEvents(EVENTS, new Set(["1"]), [{ url: "https://h" }]);
    expect(out[0].events.map((e) => e.id)).toEqual(["2", "3"]);
  });

  it("filters by event types", () => {
    const watchers: Watcher[] = [{ url: "https://h", types: ["deprecated"] }];
    const out = selectEvents(EVENTS, new Set(), watchers);
    expect(out[0].events.map((e) => e.id)).toEqual(["2"]);
  });

  it("filters by labs and drops unattributed events", () => {
    const watchers: Watcher[] = [{ url: "https://h", labs: ["openai"] }];
    const out = selectEvents(EVENTS, new Set(), watchers);
    expect(out[0].events.map((e) => e.id)).toEqual(["1"]);
  });

  it("omits watchers with no matching events", () => {
    const out = selectEvents(EVENTS, new Set(["1", "2", "3"]), [{ url: "https://h" }]);
    expect(out).toHaveLength(0);
  });
});
