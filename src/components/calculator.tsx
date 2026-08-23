"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPerM } from "@/lib/format";
import { EmptyTableRow, SortableTh, TablePager, type SortDirection } from "@/components/data-table";
import { Bar } from "@/components/ui";

export interface CalcRow {
  id: string;
  name: string;
  lab: string;
  input: number;
  output: number;
  cacheRead: number | null;
}

export function Calculator({ rows }: { rows: CalcRow[] }) {
  const [inM, setInM] = useState(20);
  const [outM, setOutM] = useState(3);
  const [hitPct, setHitPct] = useState(60);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"monthly" | "name" | "input" | "output">("monthly");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const hit = hitPct / 100;

  const priced = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .map((r) => {
        const cacheRead = r.cacheRead ?? r.input;
        const monthly = inM * (1 - hit) * r.input + inM * hit * cacheRead + outM * r.output;
        return { ...r, monthly };
      })
      .filter((r) => !needle || `${r.name} ${r.id}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const value = sort === "name" ? a.name.localeCompare(b.name) : a[sort] - b[sort];
        return direction === "asc" ? value : -value;
      });
  }, [rows, inM, outM, hit, q, sort, direction]);

  const max = priced.reduce((value, row) => Math.max(value, row.monthly), 1);
  const totalPages = Math.max(1, Math.ceil(priced.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = priced.slice((current - 1) * pageSize, current * pageSize);

  function changeSort(next: typeof sort) {
    setDirection((value) => next === sort ? (value === "asc" ? "desc" : "asc") : "asc");
    setSort(next);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="card grid gap-6 p-5 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          <span className="flex justify-between text-black/60">
            Input tokens / month <b className="font-mono text-black">{inM}M</b>
          </span>
          <input type="range" min={0.1} max={500} step={0.1} value={inM} onChange={(e) => setInM(Number(e.target.value))} className="w-full accent-accent" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="flex justify-between text-black/60">
            Output tokens / month <b className="font-mono text-black">{outM}M</b>
          </span>
          <input type="range" min={0.1} max={100} step={0.1} value={outM} onChange={(e) => setOutM(Number(e.target.value))} className="w-full accent-accent" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="flex justify-between text-black/60">
            Cache hit rate <b className="font-mono text-black">{hitPct}%</b>
          </span>
          <input type="range" min={0} max={95} step={5} value={hitPct} onChange={(e) => setHitPct(Number(e.target.value))} className="w-full accent-accent" />
        </label>
      </div>

      <div className="data-table-shell">
        <div className="data-table-toolbar">
          <label htmlFor="calculator-filter" className="sr-only">Filter models</label>
          <input id="calculator-filter" type="search" className="input w-full sm:w-64" placeholder="Filter models…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <span className="ml-auto font-mono text-xs tabular-nums text-black/60">{priced.length} models</span>
        </div>
      <div className="data-table-viewport">
        <table className="table-base min-w-[680px]">
          <thead>
            <tr>
              <th>#</th>
              <SortableTh label="model" active={sort === "name"} direction={direction} onSort={() => changeSort("name")}>Model</SortableTh>
              <SortableTh label="estimated monthly cost" active={sort === "monthly"} direction={direction} onSort={() => changeSort("monthly")} align="right">Est. monthly</SortableTh>
              <th>Relative</th>
              <SortableTh label="input price" active={sort === "input"} direction={direction} onSort={() => changeSort("input")} align="right">In / Out per M</SortableTh>
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
                </td>
                <td className="text-right font-mono font-semibold tabular-nums text-black">
                  ${r.monthly < 1 ? r.monthly.toFixed(2) : r.monthly.toFixed(0)}
                </td>
                <td className="w-40">
                  <Bar pct={r.monthly / max} tone="accent" label={`${r.name} relative monthly cost`} />
                </td>
                <td className="whitespace-nowrap text-right font-mono tabular-nums text-black/60">
                  {fmtPerM(r.input)} / {fmtPerM(r.output)}
                </td>
              </tr>
            ))}
            {priced.length === 0 && <EmptyTableRow colSpan={5}>No models match.</EmptyTableRow>}
          </tbody>
        </table>
      </div>
      <TablePager page={current} pageSize={pageSize} total={priced.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun="models" />
      </div>
      <p className="text-xs leading-relaxed text-black/60">
        Estimate uses each model&apos;s cheapest listed provider. Cache-hit spend is billed at the
        provider&apos;s cache-read rate when published, otherwise at the input rate.
      </p>
    </div>
  );
}
