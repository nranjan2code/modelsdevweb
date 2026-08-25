"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";
import { toggleCompare, useCompareSelection } from "@/lib/compare";
import { Badge } from "@/components/ui";
import { EmptyTableRow, TablePager } from "@/components/data-table";

export interface BrowseRow {
  id: string;
  name: string;
  lab: string;
  input: number | null;
  output: number | null;
  free: boolean;
  ctx: number | null;
  reasoning: boolean;
  tools: boolean;
  structured: boolean;
  vision: boolean;
  audio: boolean;
  video: boolean;
  pdf: boolean;
  open: boolean;
  released: string | null;
  providers: number;
  swe: number | null;
  flags: string[];
  tracked: boolean;
}

// Compact transport shape: repeated object keys account for much of the
// static catalog payload. Capability booleans are packed into one bit mask.
export type PackedBrowseRow = [
  id: string,
  name: string,
  lab: string,
  input: number | null,
  output: number | null,
  free: boolean,
  ctx: number | null,
  capabilities: number,
  released: string | null,
  providers: number,
  swe: number | null,
  flags: string[],
  tracked: boolean,
];

function unpackRow(row: PackedBrowseRow): BrowseRow {
  const [id, name, lab, input, output, free, ctx, capabilities, released, providers, swe, flags, tracked] = row;
  return {
    id, name, lab, input, output, free, ctx, released, providers, swe, flags, tracked,
    reasoning: Boolean(capabilities & 1),
    tools: Boolean(capabilities & 2),
    structured: Boolean(capabilities & 4),
    vision: Boolean(capabilities & 8),
    audio: Boolean(capabilities & 16),
    video: Boolean(capabilities & 32),
    pdf: Boolean(capabilities & 64),
    open: Boolean(capabilities & 128),
  };
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

const CAPS = [
  ["reasoning", "reasoning"],
  ["tools", "tools"],
  ["structured", "structured"],
  ["vision", "vision"],
  ["audio", "audio"],
  ["video", "video"],
  ["pdf", "pdf"],
  ["open", "open weights"],
] as const;

const FLAG_CAPS = new Set(["beta", "alpha", "experimental"]);

function hasCap(r: BrowseRow, cap: string): boolean {
  return FLAG_CAPS.has(cap) ? r.flags.includes(cap) : (r[cap as keyof BrowseRow] === true);
}

export function BrowseTable({ rows: packedRows }: { rows: PackedBrowseRow[] }) {
  const rows = useMemo(() => packedRows.map(unpackRow), [packedRows]);
  const [q, setQ] = useState("");
  const [ctxMin, setCtxMin] = useState(0);
  const [priceMax, setPriceMax] = useState(Number.POSITIVE_INFINITY);
  const [caps, setCaps] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("newest");
  const [includeExtended, setIncludeExtended] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const inCompare = useCompareSelection();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (!includeExtended && !r.tracked) return false;
      if (needle && !`${r.name} ${r.id} ${r.lab}`.toLowerCase().includes(needle)) return false;
      if ((r.ctx ?? 0) < ctxMin) return false;
      const effInput = r.input ?? (r.free ? 0 : null);
      if (effInput != null && effInput > priceMax) return false;
      if (effInput == null && priceMax !== Number.POSITIVE_INFINITY) return false;
      for (const cap of caps) {
        if (!hasCap(r, cap)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const ia = a.input ?? (a.free ? 0 : Number.POSITIVE_INFINITY);
      const ib = b.input ?? (b.free ? 0 : Number.POSITIVE_INFINITY);
      switch (sort) {
        case "input":
          return ia - ib;
        case "output":
          return (a.output ?? (a.free ? 0 : Number.POSITIVE_INFINITY)) - (b.output ?? (b.free ? 0 : Number.POSITIVE_INFINITY));
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
  }, [rows, q, ctxMin, priceMax, caps, sort, includeExtended]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);

  const tableRef = useRef<HTMLDivElement>(null);
  function goTo(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages));
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleCap(cap: string) {
    setPage(1);
    setCaps((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="data-table-shell" ref={tableRef}>
      <div className="data-table-toolbar">
        <input
          className="input w-56"
          placeholder="Search models…"
          aria-label="Search models"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select
          className="input"
          value={ctxMin}
          onChange={(e) => { setCtxMin(Number(e.target.value)); setPage(1); }}
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
          onChange={(e) => { setPriceMax(Number(e.target.value)); setPage(1); }}
          aria-label="Maximum input price"
        >
          {PRICE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }} aria-label="Sort by">
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
              className={`control-button ${
                caps.has(cap)
                  ? "border-black bg-black text-white shadow-hard-sm"
                  : "border-black/15 bg-white text-black/60 hover:border-black hover:text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setIncludeExtended((value) => !value); setPage(1); }}
          aria-pressed={includeExtended}
              className={`control-button ${
            includeExtended
              ? "border-special bg-special-soft text-special"
              : "border-black/15 bg-white text-black/60 hover:border-black hover:text-black"
          }`}
        >
          extended catalog
        </button>
        <span className="ml-auto font-mono text-xs tabular-nums text-black/60">
          {filtered.length} / {rows.length}
        </span>
      </div>

      <div className="data-table-viewport">
          <table className="table-base min-w-[860px]">
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
                <th>
                  <span title="Add to comparison">Cmp</span>
                </th>
              </tr>
            </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/m/${r.id}`} className="font-medium text-black transition-colors hover:text-accent">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-black/60">{r.lab}</span>
                  {r.flags.length > 0 && (
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {r.flags.map((f) => (
                        <Badge key={f} tone={f === "beta" ? "warn" : f === "alpha" ? "accent" : "special"}>
                          {f}
                        </Badge>
                      ))}
                    </span>
                  )}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {r.input != null ? fmtPerM(r.input) : r.free ? <span className="font-semibold text-pos">Free</span> : "—"}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {r.output != null ? fmtPerM(r.output) : r.free ? <span className="font-semibold text-pos">Free</span> : "—"}
                </td>
                <td className="text-right font-mono tabular-nums">{fmtTokens(r.ctx)}</td>
                <td>
                  <span className="inline-flex gap-1">
                    {(
                      [
                        ["R", r.reasoning],
                        ["T", r.tools],
                        ["S", r.structured],
                        ["V", r.vision],
                        ["A", r.audio],
                      ] as const
                    ).map(([ch, on]) => (
                      <span
                        key={ch}
                        title={
                          { R: "reasoning", T: "tool call", S: "structured output", V: "vision/attachment", A: "audio in/out" }[ch]
                        }
                        className={`inline-flex size-5 items-center justify-center rounded border text-xs font-semibold ${
                          on
                            ? "border-pos/30 bg-pos-soft text-pos"
                            : "border-black/10 bg-black/5 text-black/60"
                        }`}
                      >
                        {ch}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="text-xs">
                  {r.open ? (
                    <Badge tone="pos">open</Badge>
                  ) : (
                    <Badge tone="muted" bold={false} className="font-medium">
                      closed
                    </Badge>
                  )}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {r.swe != null ? <span className="font-semibold">{r.swe.toFixed(1)}</span> : <span className="text-black/60">—</span>}
                </td>
                <td className="text-right tabular-nums text-black/60">{r.providers}</td>
                <td className="whitespace-nowrap text-xs text-black/60">{fmtDate(r.released)}</td>
                <td>
                  <button
                    onClick={() => toggleCompare(r.id)}
                    aria-pressed={inCompare.includes(r.id)}
                    title={inCompare.includes(r.id) ? "Remove from comparison" : "Add to comparison"}
                    className={`control-button size-11 px-0 text-xs font-bold ${
                      inCompare.includes(r.id)
                        ? "border-accent bg-accent text-white"
                        : "border-black/15 bg-white text-black/60 hover:border-black hover:text-black"
                    }`}
                  >
                    {inCompare.includes(r.id) ? "✓" : "+"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <EmptyTableRow colSpan={10}>No models match these filters.</EmptyTableRow>}
          </tbody>
        </table>
      </div>
      <TablePager page={current} pageSize={pageSize} total={filtered.length} onPageChange={goTo} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun="models" />
      </div>

      {inCompare.length >= 2 && (
        <div className="sticky bottom-4 z-30 flex justify-center">
          <Link
            href="/compare"
            className="button-primary"
          >
            Compare {inCompare.length} models →
          </Link>
        </div>
      )}
    </div>
  );
}
