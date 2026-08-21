"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";

export interface BrowseRow {
  id: string;
  name: string;
  lab: string;
  input: number | null;
  output: number | null;
  ctx: number | null;
  reasoning: boolean;
  tools: boolean;
  structured: boolean;
  vision: boolean;
  open: boolean;
  released: string | null;
  providers: number;
  swe: number | null;
}

type SortKey = "input" | "output" | "newest" | "providers" | "context" | "swe";

const CTX_OPTIONS = [
  { label: "Any context", value: 0 },
  { label: "≥ 128K", value: 128_000 },
  { label: "≥ 200K", value: 200_000 },
  { label: "≥ 1M", value: 1_000_000 },
];

const PRICE_OPTIONS = [
  { label: "Any price", value: Number.POSITIVE_INFINITY },
  { label: "< $5 /M", value: 5 },
  { label: "< $1 /M", value: 1 },
  { label: "< $0.50 /M", value: 0.5 },
  { label: "Free-ish (< $0.10)", value: 0.1 },
];

export function BrowseTable({ rows }: { rows: BrowseRow[] }) {
  const [q, setQ] = useState("");
  const [ctxMin, setCtxMin] = useState(0);
  const [priceMax, setPriceMax] = useState(Number.POSITIVE_INFINITY);
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("input");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && !`${r.name} ${r.id} ${r.lab}`.toLowerCase().includes(needle)) return false;
      if ((r.ctx ?? 0) < ctxMin) return false;
      if (r.input != null && r.input > priceMax) return false;
      if (r.input == null && priceMax !== Number.POSITIVE_INFINITY) return false;
      for (const cap of caps) {
        if (!r[cap as keyof BrowseRow]) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "input":
          return (a.input ?? Number.POSITIVE_INFINITY) - (b.input ?? Number.POSITIVE_INFINITY);
        case "output":
          return (a.output ?? Number.POSITIVE_INFINITY) - (b.output ?? Number.POSITIVE_INFINITY);
        case "newest":
          return (b.released ?? "").localeCompare(a.released ?? "");
        case "providers":
          return b.providers - a.providers;
        case "context":
          return (b.ctx ?? 0) - (a.ctx ?? 0);
        case "swe":
          return (b.swe ?? -1) - (a.swe ?? -1);
      }
    });
    return out;
  }, [rows, q, ctxMin, priceMax, caps, sort]);

  function toggleCap(cap: string) {
    setCaps((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-56"
          placeholder="Search models…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input"
          value={ctxMin}
          onChange={(e) => setCtxMin(Number(e.target.value))}
          aria-label="Minimum context"
        >
          {CTX_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={String(priceMax)}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          aria-label="Maximum input price"
        >
          {PRICE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
          <option value="input">Sort: cheapest input</option>
          <option value="output">Sort: cheapest output</option>
          <option value="newest">Sort: newest</option>
          <option value="context">Sort: largest context</option>
          <option value="providers">Sort: most providers</option>
          <option value="swe">Sort: best SWE-Bench</option>
        </select>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["reasoning", "reasoning"],
            ["tools", "tools"],
            ["structured", "structured"],
            ["vision", "vision"],
            ["open", "open weights"],
          ].map(([cap, label]) => (
            <button
              key={cap}
              onClick={() => toggleCap(cap)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                caps.has(cap)
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-600/40"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-500 tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Best in /M</th>
              <th className="px-4 py-3 font-medium text-right">Best out /M</th>
              <th className="px-4 py-3 font-medium text-right">Context</th>
              <th className="px-4 py-3 font-medium">Caps</th>
              <th className="px-4 py-3 font-medium">Weights</th>
              <th className="px-4 py-3 font-medium text-right">SWE-Bench</th>
              <th className="px-4 py-3 font-medium text-right">Providers</th>
              <th className="px-4 py-3 font-medium">Released</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link href={`/m/${r.id}`} className="font-medium text-zinc-100 hover:text-emerald-400 transition-colors">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-zinc-500">{r.lab}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(r.input)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(r.output)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtTokens(r.ctx)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex gap-1">
                    {(
                      [
                        ["R", r.reasoning],
                        ["T", r.tools],
                        ["S", r.structured],
                        ["V", r.vision],
                      ] as const
                    ).map(([ch, on]) => (
                      <span
                        key={ch}
                        title={{ R: "reasoning", T: "tool call", S: "structured output", V: "vision/attachment" }[ch]}
                        className={`inline-flex size-5 items-center justify-center rounded text-[11px] ${
                          on ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800/60 text-zinc-600"
                        }`}
                      >
                        {ch}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.open ? <span className="text-emerald-400">open</span> : <span className="text-zinc-500">closed</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {r.swe != null ? <span className="text-zinc-100">{r.swe.toFixed(1)}</span> : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{r.providers}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(r.released)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  No models match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
