"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Badge, Bar } from "@/components/ui";
import { EmptyTableRow, SortableTh, TablePager, type SortDirection } from "@/components/data-table";
import { fmtDate, fmtPerM, fmtTokens } from "@/lib/format";

type SortValue = string | number | null;

interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  sortValue?: (row: T) => SortValue;
  render: (row: T, index: number) => ReactNode;
}

function SmartTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  placeholder,
  noun,
  minWidth,
  defaultSort,
  defaultDirection = "asc",
  empty,
  extraToolbar,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText: (row: T) => string;
  placeholder: string;
  noun: string;
  minWidth: string;
  defaultSort: string;
  defaultDirection?: SortDirection;
  empty: string;
  extraToolbar?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [direction, setDirection] = useState<SortDirection>(defaultDirection);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const column = columns.find((item) => item.key === sort);
    return rows
      .filter((row) => !needle || searchText(row).toLowerCase().includes(needle))
      .sort((a, b) => {
        const av = column?.sortValue?.(a) ?? null;
        const bv = column?.sortValue?.(b) ?? null;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const value = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
        return direction === "asc" ? value : -value;
      });
  }, [rows, q, sort, direction, columns, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);

  function changeSort(key: string) {
    setDirection((value) => key === sort ? (value === "asc" ? "desc" : "asc") : "asc");
    setSort(key);
    setPage(1);
  }

  return (
    <div className="data-table-shell">
      <div className="data-table-toolbar">
        <input type="search" className="input w-full sm:w-64" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder={placeholder} aria-label={placeholder} />
        {extraToolbar}
        <span className="ml-auto font-mono text-xs tabular-nums text-black/60">{filtered.length} {noun}</span>
      </div>
      <div className="data-table-viewport">
        <table className={`table-base ${minWidth}`}>
          <thead>
            <tr>
              {columns.map((column) => column.sortValue ? (
                <SortableTh key={column.key} label={column.label} active={sort === column.key} direction={direction} onSort={() => changeSort(column.key)} align={column.align}>{column.label}</SortableTh>
              ) : <th key={column.key} className={column.align === "right" ? "text-right" : undefined}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, index) => (
              <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key} className={column.align === "right" ? "text-right" : undefined}>{column.render(row, (current - 1) * pageSize + index)}</td>)}</tr>
            ))}
            {filtered.length === 0 && <EmptyTableRow colSpan={columns.length}>{empty}</EmptyTableRow>}
          </tbody>
        </table>
      </div>
      <TablePager page={current} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun={noun} />
    </div>
  );
}

export interface ProviderIndexRow {
  id: string;
  name: string;
  modelCount: number;
  npm: string | null;
  doc: string | null;
}

export function ProvidersTable({ rows }: { rows: ProviderIndexRow[] }) {
  const columns: Column<ProviderIndexRow>[] = [
    { key: "name", label: "Provider", sortValue: (row) => row.name, render: (row) => <><Link href={`/provider/${row.id}`} className="font-medium transition-colors hover:text-accent">{row.name}</Link><span className="ml-2 font-mono text-xs text-black/60">{row.id}</span></> },
    { key: "modelCount", label: "Listings", align: "right", sortValue: (row) => row.modelCount, render: (row) => <span className="tabular-nums text-black/60">{row.modelCount}</span> },
    { key: "npm", label: "SDK package", sortValue: (row) => row.npm, render: (row) => <span className="font-mono text-xs text-black/60">{row.npm ?? "—"}</span> },
    { key: "doc", label: "Docs", render: (row) => row.doc ? <a href={row.doc} target="_blank" rel="noreferrer" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">docs ↗</a> : <span className="text-black/60">—</span> },
  ];
  return <SmartTable rows={rows} columns={columns} rowKey={(row) => row.id} searchText={(row) => `${row.name} ${row.id} ${row.npm ?? ""}`} placeholder="Filter providers…" noun="providers" minWidth="min-w-[560px]" defaultSort="modelCount" defaultDirection="desc" empty="No providers match." />;
}

export interface ProviderListingRow {
  key: string;
  groupId: string;
  groupName: string;
  modelId: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  context: number | null;
  status: string | null;
  lastUpdated: string | null;
}

export function ProviderListingsTable({ rows }: { rows: ProviderListingRow[] }) {
  const [status, setStatus] = useState("all");
  const visible = status === "all" ? rows : rows.filter((row) => (row.status ?? "stable") === status);
  const columns: Column<ProviderListingRow>[] = [
    { key: "groupName", label: "Model", sortValue: (row) => row.groupName, render: (row) => <><Link href={`/m/${row.groupId}`} className="font-medium transition-colors hover:text-accent">{row.groupName}</Link>{row.modelId !== row.groupId && <span className="ml-2 font-mono text-xs text-black/60">{row.modelId}</span>}</> },
    { key: "input", label: "Input /M", align: "right", sortValue: (row) => row.input, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.input)}</span> },
    { key: "output", label: "Output /M", align: "right", sortValue: (row) => row.output, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.output)}</span> },
    { key: "cacheRead", label: "Cache read /M", align: "right", sortValue: (row) => row.cacheRead, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.cacheRead)}</span> },
    { key: "cacheWrite", label: "Cache write /M", align: "right", sortValue: (row) => row.cacheWrite, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.cacheWrite)}</span> },
    { key: "context", label: "Context", align: "right", sortValue: (row) => row.context, render: (row) => <span className="font-mono tabular-nums">{fmtTokens(row.context)}</span> },
    { key: "status", label: "Status", sortValue: (row) => row.status ?? "stable", render: (row) => row.status ? <Badge tone={row.status === "deprecated" ? "neg" : row.status === "beta" ? "warn" : "accent"}>{row.status}</Badge> : <Badge tone="muted">stable</Badge> },
    { key: "lastUpdated", label: "Updated", sortValue: (row) => row.lastUpdated, render: (row) => <span className="whitespace-nowrap text-xs text-black/60">{fmtDate(row.lastUpdated)}</span> },
  ];
  const filter = <select className="input" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="stable">Stable</option><option value="beta">Beta</option><option value="alpha">Alpha</option><option value="deprecated">Deprecated</option></select>;
  return <SmartTable rows={visible} columns={columns} rowKey={(row) => row.key} searchText={(row) => `${row.groupName} ${row.groupId} ${row.modelId}`} placeholder="Filter models or variants…" noun="listings" minWidth="min-w-[880px]" defaultSort="groupName" empty="No listings match." extraToolbar={filter} />;
}

export interface LabModelRow {
  id: string;
  name: string;
  input: number | null;
  output: number | null;
  context: number | null;
  /** Providers still serving it — organisations, not endpoint variants. */
  providers: number;
  /** Providers that have withdrawn their endpoint while others still serve it. */
  withdrawn: number;
  released: string | null;
}

export function LabModelsTable({ rows }: { rows: LabModelRow[] }) {
  const columns: Column<LabModelRow>[] = [
    { key: "name", label: "Model", sortValue: (row) => row.name, render: (row) => <Link href={`/m/${row.id}`} className="font-medium transition-colors hover:text-accent">{row.name}</Link> },
    { key: "input", label: "Best in /M", align: "right", sortValue: (row) => row.input, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.input)}</span> },
    { key: "output", label: "Best out /M", align: "right", sortValue: (row) => row.output, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.output)}</span> },
    { key: "context", label: "Context", align: "right", sortValue: (row) => row.context, render: (row) => <span className="font-mono tabular-nums">{fmtTokens(row.context)}</span> },
    { key: "providers", label: "Live providers", align: "right", sortValue: (row) => row.providers, render: (row) => (
      <span className="whitespace-nowrap tabular-nums text-black/60">
        {row.providers}
        {row.withdrawn > 0 && (
          <span className="ml-1.5 text-xs text-neg" title={`${row.withdrawn} provider${row.withdrawn === 1 ? " has" : "s have"} withdrawn this model`}>
            −{row.withdrawn}
          </span>
        )}
      </span>
    ) },
    { key: "released", label: "Released", sortValue: (row) => row.released, render: (row) => <span className="whitespace-nowrap text-xs text-black/60">{fmtDate(row.released)}</span> },
  ];
  return <SmartTable rows={rows} columns={columns} rowKey={(row) => row.id} searchText={(row) => `${row.name} ${row.id}`} placeholder="Filter models…" noun="models" minWidth="min-w-[680px]" defaultSort="released" defaultDirection="desc" empty="No models match." />;
}

export interface BenchmarkTableRow {
  groupId: string;
  groupName: string;
  labId: string;
  score: number;
  bestInput: number | null;
  bestOutput: number | null;
  pointsPerDollar: number | null;
  /** Dollars to run one request of this board's workload. */
  costPerRun: number | null;
  context: number | null;
}

const fmtRun = (value: number | null) =>
  value == null ? "—" : value >= 0.01 ? `$${value.toFixed(3)}` : `${(value * 100).toFixed(3)}\u00a2`;

const fmtPpd = (value: number | null) => value == null ? "—" : !Number.isFinite(value) ? "free" : value >= 100 ? Math.round(value).toLocaleString("en-US") : value.toFixed(1);

export function BenchmarkEntriesTable({ rows, maxScore }: { rows: BenchmarkTableRow[]; maxScore: number }) {
  const scoreOrder = [...rows].sort((a, b) => b.score - a.score).map((row) => row.groupId);
  const columns: Column<BenchmarkTableRow>[] = [
    { key: "rank", label: "#", render: (row) => { const rank = scoreOrder.indexOf(row.groupId) + 1; return <span className="tabular-nums text-black/60">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}</span>; } },
    { key: "groupName", label: "Model", sortValue: (row) => row.groupName, render: (row) => <><Link href={`/m/${row.groupId}`} className="font-medium transition-colors hover:text-accent">{row.groupName}</Link><span className="ml-2 text-xs text-black/60">{row.labId}</span></> },
    { key: "score", label: "Score", sortValue: (row) => row.score, render: (row) => <div className="flex w-48 items-center gap-2"><span className="w-12 shrink-0 font-mono font-semibold tabular-nums">{row.score}</span><Bar pct={row.score / maxScore} tone="accent" label={`${row.groupName}: benchmark score ${row.score}`} /></div> },
    { key: "bestInput", label: "Best in /M", align: "right", sortValue: (row) => row.bestInput, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.bestInput)}</span> },
    { key: "bestOutput", label: "Best out /M", align: "right", sortValue: (row) => row.bestOutput, render: (row) => <span className="font-mono tabular-nums">{fmtPerM(row.bestOutput)}</span> },
    { key: "costPerRun", label: "Cost / run", align: "right", sortValue: (row) => row.costPerRun, render: (row) => <span className="font-mono tabular-nums text-black/70">{fmtRun(row.costPerRun)}</span> },
    { key: "pointsPerDollar", label: "Pts / $", align: "right", sortValue: (row) => row.pointsPerDollar, render: (row) => <span className="font-mono font-semibold tabular-nums text-pos">{fmtPpd(row.pointsPerDollar)}</span> },
    { key: "context", label: "Context", align: "right", sortValue: (row) => row.context, render: (row) => <span className="font-mono tabular-nums text-black/60">{fmtTokens(row.context)}</span> },
  ];
  return <SmartTable rows={rows} columns={columns} rowKey={(row) => row.groupId} searchText={(row) => `${row.groupName} ${row.groupId} ${row.labId}`} placeholder="Filter leaderboard…" noun="models" minWidth="min-w-[980px]" defaultSort="score" defaultDirection="desc" empty="No benchmark entries match." />;
}

export interface DeprecationTableRow {
  id: string;
  name: string;
  lab: string;
  providers: string[];
  lastUpdated: string | null;
  bestInput: number | null;
}

export function DeprecationsTable({ rows }: { rows: DeprecationTableRow[] }) {
  const columns: Column<DeprecationTableRow>[] = [
    { key: "name", label: "Model", sortValue: (row) => row.name, render: (row) => <><Link href={`/m/${row.id}`} className="font-medium transition-colors hover:text-accent">{row.name}</Link><span className="ml-2 text-xs text-black/60">{row.lab}</span></> },
    { key: "providers", label: "Deprecated on", sortValue: (row) => row.providers.length, render: (row) => <span className="inline-flex flex-wrap gap-1">{row.providers.map((provider) => <Badge key={provider} tone="neg">{provider}</Badge>)}</span> },
    { key: "lastUpdated", label: "Last updated", align: "right", sortValue: (row) => row.lastUpdated, render: (row) => <span className="whitespace-nowrap text-xs text-black/60">{fmtDate(row.lastUpdated)}</span> },
    { key: "bestInput", label: "Cheapest live price", align: "right", sortValue: (row) => row.bestInput, render: (row) => row.bestInput != null ? <span className="font-mono font-semibold tabular-nums text-pos">{fmtPerM(row.bestInput)}</span> : <span className="text-black/60">none live</span> },
  ];
  return <SmartTable rows={rows} columns={columns} rowKey={(row) => row.id} searchText={(row) => `${row.name} ${row.id} ${row.lab} ${row.providers.join(" ")}`} placeholder="Filter models or providers…" noun="models" minWidth="min-w-[720px]" defaultSort="lastUpdated" defaultDirection="desc" empty="No deprecated listings in the current snapshot." />;
}
