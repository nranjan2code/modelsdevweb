"use client";

import { useMemo, useState } from "react";
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

export function ChangelogList({ events }: { events: Event[] }) {
  const [type, setType] = useState<EventType | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (needle && !`${e.modelName} ${e.modelKey} ${e.providerId ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [events, type, q]);

  const grouped = useMemo(() => {
    const groups: { date: string; events: Event[] }[] = [];
    for (const e of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.events.push(e);
      else groups.push({ date: e.date, events: [e] });
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-56" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                type === t.value
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-600/40"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-500 tabular-nums">{filtered.length} events</span>
      </div>

      {filtered.length === 0 ? (
        <p className="card p-6 text-sm text-zinc-500">
          No events yet. The first sync captured a baseline; diffs appear here as models.dev data changes.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.date} className="space-y-2">
              <h2 className="text-sm font-medium text-zinc-400 sticky top-14 bg-zinc-950/90 backdrop-blur py-1">
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
