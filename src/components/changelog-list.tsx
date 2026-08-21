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
        <span className="ml-auto font-mono text-xs tabular-nums text-black/45">{filtered.length} events</span>
      </div>

      {filtered.length === 0 ? (
        <p className="card-dashed p-6 text-sm text-black/50">
          No events yet. The first sync captured a baseline; diffs appear here as models.dev data changes.
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
