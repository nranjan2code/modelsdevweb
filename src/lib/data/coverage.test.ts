import { describe, expect, it } from "vitest";
import type { Event } from "../pipeline/types";
import type { PriceArchive } from "./archive";
import { coverage, observedEvents, windowLabel } from "./coverage";

const ev = (date: string, n: number): Event[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${date}-${i}`,
    type: "repriced" as const,
    date,
    modelKey: "p/m",
    modelName: "M",
    canonicalId: "lab/m",
    labId: "lab",
    providerId: "p",
    changes: [],
  }));

const archive = (days: number): PriceArchive => ({
  dates: Array.from({ length: days }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`),
  models: {},
});

describe("coverage", () => {
  it("excludes the first sync's cold-start diff from the observed window", () => {
    const events = [...ev("2026-08-21", 42), ...ev("2026-08-22", 121), ...ev("2026-08-23", 7)];
    // 08-22 is not the first day, so the big day is real activity, not a cold start.
    const c = coverage(events, archive(3));
    expect(c.coldStartDate).toBeNull();
    expect(c.observedDays).toBe(3);
  });

  it("flags a first day that dwarfs the days after it", () => {
    const events = [...ev("2026-08-21", 300), ...ev("2026-08-22", 8), ...ev("2026-08-23", 5)];
    const c = coverage(events, archive(3));
    expect(c.coldStartDate).toBe("2026-08-21");
    expect(c.observedDays).toBe(2);
    expect(observedEvents(events, c).every((e) => e.date !== "2026-08-21")).toBe(true);
  });

  it("never discards a busy first day when there is too little to compare against", () => {
    const events = [...ev("2026-08-21", 300), ...ev("2026-08-22", 2)];
    expect(coverage(events, archive(2)).coldStartDate).toBeNull();
  });

  it("refuses to call a short log rankable", () => {
    expect(coverage([...ev("2026-08-21", 3), ...ev("2026-08-22", 3)], archive(2)).rankable).toBe(false);
  });

  it("becomes rankable once a full week is observed", () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      ev(`2026-08-${String(i + 10).padStart(2, "0")}`, 4),
    ).flat();
    expect(coverage(events, archive(8)).rankable).toBe(true);
  });

  it("labels the window it actually has, never a fixed seven days", () => {
    expect(windowLabel(coverage([...ev("2026-08-21", 2)], archive(1)))).toBe("the last day");
    expect(windowLabel(coverage([], archive(0)))).toBe("no full day yet");
  });

  it("reports an empty log without inventing a window", () => {
    const c = coverage([], archive(0));
    expect(c.since).toBeNull();
    expect(c.observedDays).toBe(0);
    expect(c.rankable).toBe(false);
  });
});
