"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPerM } from "@/lib/format";
import { Badge } from "@/components/ui";
import { EmptyTableRow, SortableTh, TablePager, type SortDirection } from "@/components/data-table";

export interface HostRow {
  id: string;
  name: string;
  labName: string;
  parameters: number;
  gpus: number;
  gpuName: string;
  rentPerMonth: number;
  apiPerM: number;
  licence: string | null;
}

/** Presets in monthly tokens — the volumes people actually recognise. */
const PRESETS: { label: string; tokens: number; hint: string }[] = [
  { label: "Side project", tokens: 5_000_000, hint: "5M / month" },
  { label: "Small product", tokens: 100_000_000, hint: "100M / month" },
  { label: "Scaling up", tokens: 1_000_000_000, hint: "1B / month" },
  { label: "High volume", tokens: 10_000_000_000, hint: "10B / month" },
];

const usd = (n: number) =>
  n >= 10_000
    ? `$${Math.round(n / 1000).toLocaleString("en-US")}k`
    : `$${Math.round(n).toLocaleString("en-US")}`;

const tokens = (n: number) =>
  n >= 1e9 ? `${Number((n / 1e9).toFixed(1))}B` : n >= 1e6 ? `${Math.round(n / 1e6)}M` : `${Math.round(n / 1e3)}K`;

export function SelfHostTable({ rows }: { rows: HostRow[] }) {
  const [monthly, setMonthly] = useState(100_000_000);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "apiCost" | "rentPerMonth" | "savings">("savings");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const scored = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .map((r) => {
        const apiCost = (monthly / 1e6) * r.apiPerM;
        return { ...r, apiCost, savings: apiCost - r.rentPerMonth };
      })
      .filter((r) => !needle || `${r.name} ${r.labName}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const value = sort === "name" ? a.name.localeCompare(b.name) : a[sort] - b[sort];
        return direction === "asc" ? value : -value;
      });
  }, [rows, monthly, q, sort, direction]);

  const flipped = scored.filter((r) => r.savings > 0).length;
  const totalPages = Math.max(1, Math.ceil(scored.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = scored.slice((current - 1) * pageSize, current * pageSize);

  function changeSort(next: typeof sort) {
    setDirection((value) => next === sort ? (value === "asc" ? "desc" : "asc") : next === "name" ? "asc" : "desc");
    setSort(next);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div>
          <label htmlFor="volume" className="mono-label">
            Your monthly volume for one model
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="volume"
              type="range"
              min={6}
              max={11}
              step={0.1}
              value={Math.log10(monthly)}
              onChange={(e) => setMonthly(Math.round(10 ** Number(e.target.value)))}
              className="h-2 min-w-[12rem] flex-1 cursor-pointer accent-accent"
              aria-describedby="volume-value"
            />
            <output id="volume-value" className="font-mono text-2xl font-bold tabular-nums text-black">
              {tokens(monthly)}
              <span className="text-sm font-medium text-black/60"> tokens/mo</span>
            </output>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setMonthly(p.tokens)}
                aria-pressed={monthly === p.tokens}
                className={`control-button ${
                  monthly === p.tokens
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-white text-black/60 hover:border-black hover:text-black"
                }`}
              >
                {p.label} <span className="font-mono">· {p.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="border-t border-black/10 pt-3 text-sm leading-relaxed text-black/70">
          At {tokens(monthly)} tokens a month,{" "}
          {flipped === 0 ? (
            <>
              <strong className="font-semibold text-pos">buying the API wins for every model here.</strong>{" "}
              A rented GPU costs more than your whole bill would.
            </>
          ) : (
            <>
              <strong className="font-semibold">{flipped}</strong> of {scored.length} model
              {scored.length === 1 ? "" : "s"} would cost more via API than the GPU rent — the point
              at which self-hosting becomes worth pricing out properly.
            </>
          )}
        </p>
      </div>

      <div className="data-table-shell">
        <div className="data-table-toolbar">
          <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Filter models…" aria-label="Filter models" className="input w-full sm:max-w-xs" />
          <span className="ml-auto font-mono text-xs tabular-nums text-black/60">{scored.length} models</span>
        </div>
      <div className="data-table-viewport">
        <table className="table-base min-w-[720px]">
          <thead>
            <tr>
              <SortableTh label="model" active={sort === "name"} direction={direction} onSort={() => changeSort("name")}>Model</SortableTh>
              <SortableTh label="API cost" active={sort === "apiCost"} direction={direction} onSort={() => changeSort("apiCost")} align="right">API at your volume</SortableTh>
              <SortableTh label="GPU rent" active={sort === "rentPerMonth"} direction={direction} onSort={() => changeSort("rentPerMonth")} align="right">Cheapest GPU that fits</SortableTh>
              <SortableTh label="cost difference" active={sort === "savings"} direction={direction} onSort={() => changeSort("savings")} align="right">Difference</SortableTh>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/m/${r.id}`} className="font-medium transition-colors hover:text-accent">
                    {r.name}
                  </Link>
                  <div className="mono-label">
                    {r.labName} · {Math.round(r.parameters / 1e9)}B · {fmtPerM(r.apiPerM)}/M
                  </div>
                </td>
                <td className="text-right font-mono tabular-nums">{usd(r.apiCost)}</td>
                <td className="text-right font-mono tabular-nums">
                  {usd(r.rentPerMonth)}
                  <div className="mono-label">
                    {r.gpus}× {r.gpuName}
                  </div>
                </td>
                <td
                  className={`text-right font-mono font-semibold tabular-nums ${
                    r.savings > 0 ? "text-pos" : "text-black/60"
                  }`}
                >
                  {r.savings > 0 ? `+${usd(r.savings)}` : `−${usd(Math.abs(r.savings))}`}
                </td>
                <td>
                  {r.savings > 0 ? (
                    <Badge tone="pos">Worth pricing out</Badge>
                  ) : (
                    <Badge tone="muted">Keep buying</Badge>
                  )}
                </td>
              </tr>
            ))}
            {scored.length === 0 && <EmptyTableRow colSpan={5}>No models match that filter.</EmptyTableRow>}
          </tbody>
        </table>
      </div>
      <TablePager page={current} pageSize={pageSize} total={scored.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun="models" />
      </div>
    </div>
  );
}
