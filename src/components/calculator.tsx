"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPerM } from "@/lib/format";
import { EmptyTableRow, SortableTh, TablePager, type SortDirection } from "@/components/data-table";
import { Badge, Bar } from "@/components/ui";
import { costOf, WORKLOADS, type Workload } from "@/lib/economics/workload";
import { setWorkload, useWorkload } from "@/lib/workload-state";
import type { Cost } from "@/lib/pipeline/types";

export interface CalcRow {
  id: string;
  name: string;
  lab: string;
  input: number;
  output: number;
  /** The whole rate card — tiers and cache terms decide the bill, not the pair. */
  cost: Cost;
}

/** Requests per month, not tokens: a request is the unit a workload is defined in. */
const VOLUMES = [10_000, 100_000, 1_000_000, 10_000_000];

export function Calculator({ rows }: { rows: CalcRow[] }) {
  // Persisted, so the reader's profile survives navigation and return visits
  // rather than resetting to the site default on every page.
  const workload: Workload = useWorkload();
  const [requests, setRequests] = useState(100_000);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"monthly" | "name" | "input" | "output">("monthly");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const priced = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .map((r) => {
        const bill = costOf(r.cost, workload);
        return {
          ...r,
          bill,
          monthly: bill.priced ? bill.total * requests : null,
        };
      })
      .filter((r) => r.monthly != null)
      .filter((r) => !needle || `${r.name} ${r.id}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const value =
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "monthly"
              ? a.monthly! - b.monthly!
              : a[sort] - b[sort];
        return direction === "asc" ? value : -value;
      });
  }, [rows, workload, requests, q, sort, direction]);

  const max = priced.reduce((value, row) => Math.max(value, row.monthly ?? 0), 1);
  const totalPages = Math.max(1, Math.ceil(priced.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = priced.slice((current - 1) * pageSize, current * pageSize);
  const tiered = priced.filter((r) => r.bill.tier != null).length;

  function changeSort(next: typeof sort) {
    setDirection((value) => (next === sort ? (value === "asc" ? "desc" : "asc") : "asc"));
    setSort(next);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="micro-label shrink-0">Workload</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workload">
            {WORKLOADS.map((w) => {
              const on = w.id === workload.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setWorkload(w.id); setPage(1); }}
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
        <p className="text-sm leading-relaxed text-black/60">{workload.description}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-black/10 pt-3 sm:grid-cols-5">
          <Cell k="input" v={`${compactTokens(workload.inputTokens)} tok`} />
          <Cell k="output" v={`${compactTokens(workload.outputTokens)} tok`} />
          <Cell k="reasoning" v={workload.reasoningTokens ? `${compactTokens(workload.reasoningTokens)} tok` : "—"} />
          <Cell k="cache hit" v={`${Math.round(workload.cacheHitRate * 100)}%`} />
          <Cell k="context" v={`${compactTokens(workload.contextTokens)} tok`} />
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3">
          <span className="micro-label shrink-0">Requests / month</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Monthly request volume">
            {VOLUMES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === requests}
                onClick={() => setRequests(v)}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums transition ${
                  v === requests
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-black/15 bg-white text-black/60 hover:border-black/30 hover:text-black"
                }`}
              >
                {compactTokens(v)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="data-table-shell">
        <div className="data-table-toolbar">
          <label htmlFor="calculator-filter" className="sr-only">Filter models</label>
          <input id="calculator-filter" type="search" className="input w-full sm:w-64" placeholder="Filter models…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <span className="ml-auto font-mono text-xs tabular-nums text-black/60">{priced.length} models</span>
        </div>
        <div className="data-table-viewport">
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>#</th>
                <SortableTh label="model" active={sort === "name"} direction={direction} onSort={() => changeSort("name")}>Model</SortableTh>
                <SortableTh label="estimated monthly cost" active={sort === "monthly"} direction={direction} onSort={() => changeSort("monthly")} align="right">Est. monthly</SortableTh>
                <th>Relative</th>
                <th className="text-right">Per request</th>
                <SortableTh label="input price" active={sort === "input"} direction={direction} onSort={() => changeSort("input")} align="right">Sticker in / out</SortableTh>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => (
                <tr key={r.id}>
                  <td className="tabular-nums text-black/60">{(current - 1) * pageSize + i + 1}</td>
                  <td>
                    <Link href={`/m/${r.id}`} className="font-medium transition-colors hover:text-accent">
                      {r.name}
                    </Link>
                    <span className="ml-2 text-xs text-black/60">{r.lab}</span>
                    {r.bill.tier != null && (
                      <span className="ml-2 align-middle">
                        <Badge tone="warn" mono>
                          {compactTokens(r.bill.tier.minContext)}+ tier
                        </Badge>
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono font-semibold tabular-nums text-black">
                    {fmtUsd(r.monthly!)}
                  </td>
                  <td className="w-40">
                    <Bar pct={(r.monthly ?? 0) / max} tone="accent" label={`${r.name} relative monthly cost`} />
                  </td>
                  <td className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-black/60">
                    {fmtCents(r.bill.total)}
                  </td>
                  <td className="whitespace-nowrap text-right font-mono tabular-nums text-black/60">
                    {fmtPerM(r.input)} / {fmtPerM(r.output)}
                  </td>
                </tr>
              ))}
              {priced.length === 0 && <EmptyTableRow colSpan={6}>No models match.</EmptyTableRow>}
            </tbody>
          </table>
        </div>
        <TablePager page={current} pageSize={pageSize} total={priced.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun="models" />
      </div>

      <div className="space-y-1.5 text-xs leading-relaxed text-black/60">
        <p>
          Each estimate uses the model&apos;s cheapest listed provider and bills every line the
          workload touches: uncached input, cache reads, cache <em>writes</em>, reasoning tokens and
          output. Where a provider publishes no cache or reasoning rate, those tokens are billed at
          the full input or output rate — we never assume a discount nobody offers.
        </p>
        {tiered > 0 && (
          <p>
            {tiered} of these models charge a higher rate at this workload&apos;s context length; the
            figures above use that tier, not the headline price.
          </p>
        )}
        <p>Sticker prices are shown for reference only — they are not what the workload costs.</p>
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="micro-label">{k}</dt>
      <dd className="font-mono text-xs tabular-nums text-black/70">{v}</dd>
    </div>
  );
}

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${Number((n / 1_000).toFixed(1))}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function fmtCents(n: number): string {
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `${(n * 100).toFixed(3)}¢`;
}
