"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Event, EventType } from "@/lib/pipeline/types";
import { EventCard } from "@/components/event-card";
import { Badge, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/format";

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
      <div className="card-flat grid gap-4 p-4 xl:grid-cols-[14rem_minmax(0,1fr)_auto] xl:items-end">
        <div>
          <label htmlFor="changelog-search" className="mono-label mb-2 block">Find a model or provider</label>
          <input id="changelog-search" type="search" className="input w-full" placeholder="Search changes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="mono-label mb-2">Change type</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by change type">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFilters(makeFilters(t.value, days))}
                  aria-pressed={type === t.value}
                  className={`control-button ${
                    type === t.value
                      ? "border-accent/30 bg-accent-soft text-accent-strong"
                      : "border-black/15 bg-white text-black/60 hover:border-accent hover:text-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mono-label mb-2">Time range</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by time range">
              {WINDOWS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setFilters(makeFilters(type, w.value))}
                  aria-pressed={days === w.value}
                  className={`control-button ${
                    days === w.value
                      ? "border-accent/30 bg-accent-soft text-accent-strong"
                      : "border-black/15 bg-white text-black/60 hover:border-accent hover:text-accent"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="pb-3 text-left xl:text-right">
          <span className="font-mono text-sm font-semibold tabular-nums text-black" role="status" aria-live="polite">{filtered.length}</span>
          <span className="ml-1 text-xs text-black/60">events</span>
        </div>
      </div>

      {isFiltered && (
        <div className="flex items-center gap-2 rounded-md border border-accent/25 bg-accent-soft px-3 py-1.5 text-xs text-accent-strong">
          <span>
            Filtered view — {TYPES.find((t) => t.value === type)?.label.toLowerCase()}
            {days ? ` · last ${days} days` : ""}
          </span>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="control-button ml-auto"
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
            <section key={group.date} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="font-hand text-xl font-bold text-black">
                  <time dateTime={group.date}>{fmtDate(group.date)}</time>
                </h2>
                <Badge tone="neutral" mono>{group.events.length} events</Badge>
                <span className="h-px flex-1 bg-black/10" aria-hidden="true" />
              </div>
              <div className="overflow-hidden rounded-lg border border-black/15 bg-surface">
                <div className="mono-label hidden grid-cols-12 gap-4 border-b border-black/15 bg-surface-tint px-4 py-3 lg:grid">
                  <span className="col-span-4">Model and provider</span>
                  <span className="col-span-7">What changed</span>
                  <span className="text-right">Details</span>
                </div>
                <div className="divide-y divide-black/10">
                {group.events.map((e) => (
                  <EventCard key={e.id} event={e} layout="ledger" />
                ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
