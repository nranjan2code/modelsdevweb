"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Event, EventType } from "@/lib/pipeline/types";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/ui";

const TYPES: { value: EventType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "model_added", label: "New models" },
  { value: "provider_added", label: "New providers" },
  { value: "repriced", label: "Repriced" },
  { value: "deprecated", label: "Deprecated" },
  { value: "context_changed", label: "Context" },
  { value: "capability_changed", label: "Capabilities" },
];

const WINDOWS: { value: number; label: string }[] = [
  { value: 0, label: "Any time" },
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
];

const KNOWN_TYPES = new Set(TYPES.map((t) => t.value));

interface Filters {
  type: EventType | "all";
  days: number;
  /** Epoch ms below which events are excluded; computed when the filter is applied, not during render. */
  cutoff: number;
}

const DEFAULT_FILTERS: Filters = { type: "all", days: 0, cutoff: 0 };

function makeFilters(type: EventType | "all", days: number): Filters {
  return { type, days, cutoff: days ? Date.now() - days * 86_400_000 : 0 };
}

function readFilters(): Filters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const p = new URLSearchParams(window.location.search);
    const rawType = p.get("type");
    const rawDays = Number(p.get("days"));
    const type =
      rawType && KNOWN_TYPES.has(rawType as EventType | "all") ? (rawType as EventType | "all") : "all";
    const days = rawDays === 7 || rawDays === 14 || rawDays === 30 ? rawDays : 0;
    return makeFilters(type, days);
  } catch {
    return DEFAULT_FILTERS;
  }
}

let cacheUrl: string | null = null;
let cacheVal: Filters = DEFAULT_FILTERS;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onPop = () => {
    for (const l of listeners) l();
  };
  window.addEventListener("popstate", onPop);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onPop);
  };
}

/**
 * Snapshot is keyed by the current query string so client-side navigations
 * (pushState — which fires no popstate) re-read the URL instead of serving
 * a stale cached filter from a previous visit.
 */
function getSnapshot(): Filters {
  const url = window.location.search;
  if (url !== cacheUrl) {
    cacheUrl = url;
    cacheVal = readFilters();
  }
  return cacheVal;
}

function getServerSnapshot(): Filters {
  return DEFAULT_FILTERS;
}

function setFilters(next: Filters): void {
  cacheVal = next;
  cacheUrl = typeof window !== "undefined" ? window.location.search : null;
  if (typeof window !== "undefined") {
    const p = new URLSearchParams();
    if (next.type !== "all") p.set("type", next.type);
    if (next.days) p.set("days", String(next.days));
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }
  for (const l of listeners) l();
}
function useFilters(): Filters {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ChangelogList({ events }: { events: Event[] }) {
  const { type, days, cutoff } = useFilters();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (cutoff && new Date(`${e.date}T00:00:00Z`).getTime() < cutoff) return false;
      if (needle && !`${e.modelName} ${e.modelKey} ${e.providerId ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [events, type, cutoff, q]);

  const grouped = useMemo(() => {
    const groups: { date: string; events: Event[] }[] = [];
    for (const e of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.events.push(e);
      else groups.push({ date: e.date, events: [e] });
    }
    return groups;
  }, [filtered]);

  const isFiltered = type !== "all" || days !== 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="changelog-search" className="sr-only">Search changes</label>
        <input id="changelog-search" type="search" className="input w-56" placeholder="Search changes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilters(makeFilters(t.value, days))}
              aria-pressed={type === t.value}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                type === t.value
                  ? "border-black bg-black text-white shadow-hard-sm"
                  : "border-black/15 bg-white text-black/60 hover:border-black hover:text-black"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setFilters(makeFilters(type, w.value))}
              aria-pressed={days === w.value}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                days === w.value
                  ? "border-black bg-black text-white shadow-hard-sm"
                  : "border-black/15 bg-white text-black/60 hover:border-black hover:text-black"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs tabular-nums text-black/60">{filtered.length} events</span>
      </div>

      {isFiltered && (
        <div className="flex items-center gap-2 rounded-md border border-accent/25 bg-accent-soft px-3 py-1.5 text-xs text-accent-strong">
          <span>
            Filtered view — {TYPES.find((t) => t.value === type)?.label.toLowerCase()}
            {days ? ` · last ${days} days` : ""}
          </span>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="ml-auto inline-flex min-h-11 items-center rounded border border-accent/40 px-3 py-2 font-semibold transition-colors hover:border-accent hover:bg-white"
          >
            clear ×
          </button>
        </div>
      )}

      {grouped.length === 0 ? (
        <EmptyState>
          {isFiltered || q
            ? "No events match this filter."
            : "No events yet. The first sync captured a baseline; diffs appear here as models.dev data changes."}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.date} className="space-y-3">
              <h2 className="sticky top-16 z-10 w-fit border border-black/15 bg-warn-fill px-2 py-1 font-hand text-xl font-bold text-black">
                {group.date}
              </h2>
              <div className="border-y border-black/15">
                {group.events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
