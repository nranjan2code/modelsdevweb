"use client";

import { WORKLOADS } from "@/lib/economics/workload";
import { setWorkload, useWorkload } from "@/lib/workload-state";

/**
 * Names the assumption behind every price on the page, and lets the reader
 * change it. The site used to assert a fixed 3:1 input:output blend without
 * saying so anywhere — a figure whose workload is invisible is a figure the
 * reader cannot check.
 */
export function WorkloadSwitcher({ compact = false }: { compact?: boolean }) {
  const active = useWorkload();
  return (
    <div className={compact ? "space-y-2" : "card space-y-3 p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="micro-label shrink-0">Priced for</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workload">
          {WORKLOADS.map((w) => {
            const on = w.id === active.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkload(w.id)}
                aria-pressed={on}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                  on
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-black/15 bg-white text-black/60 hover:border-black/30 hover:text-black"
                }`}
              >
                {w.name}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-black/60">
        {active.description}
      </p>
      <WorkloadProfile />
    </div>
  );
}

/** The actual numbers behind the label, so the assumption is auditable. */
export function WorkloadProfile() {
  const w = useWorkload();
  const cells: [string, string][] = [
    ["input", `${compact(w.inputTokens)} tok`],
    ["output", `${compact(w.outputTokens)} tok`],
    ["reasoning", w.reasoningTokens > 0 ? `${compact(w.reasoningTokens)} tok` : "—"],
    ["cache hit", `${Math.round(w.cacheHitRate * 100)}%`],
    ["context", `${compact(w.contextTokens)} tok`],
  ];
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-black/10 pt-2">
      {cells.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1.5">
          <dt className="micro-label">{k}</dt>
          <dd className="font-mono text-xs tabular-nums text-black/70">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${Number((n / 1_000).toFixed(1))}k`;
  return String(n);
}
