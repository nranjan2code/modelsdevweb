"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
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

const PAGE_SIZE = 50;

const CAPS = [
  ["reasoning", "reasoning"],
  ["tools", "tools"],
  ["structured", "structured"],
  ["vision", "vision"],
  ["open", "open weights"],
] as const;

export function BrowseTable({ rows }: { rows: BrowseRow[] }) {
  const [q, setQ] = useState("");
  const [ctxMin, setCtxMin] = useState(0);
  const [priceMax, setPriceMax] = useState(Number.POSITIVE_INFINITY);
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("input");
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const filterKey = `${q}|${ctxMin}|${priceMax}|${sort}|${[...caps].join(",")}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const tableRef = useRef<HTMLDivElement>(null);
  function goTo(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
          {CAPS.map(([cap, label]) => (
            <button
              key={cap}
              onClick={() => toggleCap(cap)}
              aria-pressed={caps.has(cap)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                caps.has(cap)
                  ? "border-black bg-black text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
                  : "border-black/15 bg-white text-black/55 hover:border-black hover:text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-xs tabular-nums text-black/45">
          {filtered.length} / {rows.length}
        </span>
      </div>

      <div className="card overflow-x-auto" ref={tableRef}>
        <table className="table-base min-w-[820px]">
          <thead>
            <tr>
              <th>Model</th>
              <th className="text-right">Best in /M</th>
              <th className="text-right">Best out /M</th>
              <th className="text-right">Context</th>
              <th>Caps</th>
              <th>Weights</th>
              <th className="text-right">SWE-Bench</th>
              <th className="text-right">Providers</th>
              <th>Released</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/m/${r.id}`} className="font-medium text-black transition-colors hover:text-blue-600">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-black/45">{r.lab}</span>
                </td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(r.input)}</td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(r.output)}</td>
                <td className="text-right font-mono tabular-nums">{fmtTokens(r.ctx)}</td>
                <td>
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
                        className={`inline-flex size-5 items-center justify-center rounded border text-[11px] font-semibold ${
                          on
                            ? "border-emerald-600/30 bg-emerald-50 text-emerald-700"
                            : "border-black/10 bg-black/[0.03] text-black/25"
                        }`}
                      >
                        {ch}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="text-xs">
                  {r.open ? (
                    <span className="rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      open
                    </span>
                  ) : (
                    <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] text-black/40">
                      closed
                    </span>
                  )}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {r.swe != null ? <span className="font-semibold">{r.swe.toFixed(1)}</span> : <span className="text-black/30">—</span>}
                </td>
                <td className="text-right tabular-nums text-black/55">{r.providers}</td>
                <td className="whitespace-nowrap text-xs text-black/45">{fmtDate(r.released)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-black/45">
                  No models match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 1}
            className="rounded-md border-2 border-black bg-white px-3 py-1.5 font-medium shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)] disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
          >
            ← Prev
          </button>
          {pageWindow(current, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-black/35">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goTo(p as number)}
                aria-current={p === current ? "page" : undefined}
                className={`min-w-8 rounded-md border-2 px-2 py-1.5 tabular-nums transition-all ${
                  p === current
                    ? "border-black bg-black font-semibold text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]"
                    : "border-black bg-white font-medium shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => goTo(current + 1)}
            disabled={current === totalPages}
            className="rounded-md border-2 border-black bg-white px-3 py-1.5 font-medium shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)] disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}
