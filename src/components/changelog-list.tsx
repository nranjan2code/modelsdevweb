"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Event, EventType } from "@/lib/pipeline/types";
import { EventCard } from "@/components/event-card";

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
    const days = rawDays === 7 || rawDays === 30 ? rawDays : 0;
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
        <input className="input w-56" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilters(makeFilters(t.value, days))}
              aria-pressed={type === t.value}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                type === t.value
                  ? "border-black bg-black text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
                  : "border-black/15 bg-white text-black/55 hover:border-black hover:text-black"
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
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                days === w.value
                  ? "border-blue-600 bg-blue-600 text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
                  : "border-black/15 bg-white text-black/55 hover:border-black hover:text-black"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs tabular-nums text-black/45">{filtered.length} events</span>
      </div>

      {isFiltered && (
        <div className="flex items-center gap-2 rounded-md border border-blue-600/25 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
          <span>
            Filtered view — {TYPES.find((t) => t.value === type)?.label.toLowerCase()}
            {days ? ` · last ${days} days` : ""}
          </span>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="ml-auto rounded border border-blue-600/40 px-1.5 py-0.5 font-semibold transition-colors hover:border-blue-600 hover:bg-white"
          >
            clear ×
          </button>
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="card-dashed p-6 text-sm text-black/50">
          {isFiltered || q
            ? "No events match this filter."
            : "No events yet. The first sync captured a baseline; diffs appear here as models.dev data changes."}
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.date} className="space-y-3">
              <h2 className="sticky top-16 z-10 -rotate-1 bg-amber-100 px-2 py-0.5 font-hand text-xl font-bold text-black shadow-[1px_1px_0_0_rgba(0,0,0,1)] w-fit">
                {group.date}
              </h2>
              {group.events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
