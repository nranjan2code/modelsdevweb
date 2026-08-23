"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Listing } from "@/lib/pipeline/types";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";
import { unlistedPrice } from "@/lib/pipeline/normalize";
import { Badge } from "@/components/ui";
import { EmptyTableRow, SortableTh, TablePager, type SortDirection } from "@/components/data-table";

export function CapabilityBadges({ listing }: { listing: Pick<Listing, "reasoning" | "toolCall" | "structuredOutput" | "attachment"> }) {
  const caps = [
    ["reasoning", listing.reasoning],
    ["tools", listing.toolCall],
    ["structured", listing.structuredOutput],
    ["vision", listing.attachment],
  ] as const;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {caps.map(([label, on]) => (
        <span key={label}>
          <Badge tone={on ? "pos" : "muted"} bold={Boolean(on)} className={on ? "" : "font-normal"}>
            {on ? label : `no ${label}`}
          </Badge>
        </span>
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: Listing["status"] }) {
  if (!status) return null;
  const tone = status === "deprecated" ? "neg" : status === "beta" ? "warn" : "accent";
  return <Badge tone={tone}>{status}</Badge>;
}

export function PriceTable({ listings }: { listings: Listing[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"providerName" | "input" | "output" | "context" | "lastUpdated">("input");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const variantsByProvider = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listings) counts.set(listing.providerId, (counts.get(listing.providerId) ?? 0) + 1);
    return counts;
  }, [listings]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((listing) => {
      if (needle && !`${listing.providerName} ${listing.providerId} ${listing.modelId}`.toLowerCase().includes(needle)) return false;
      if (status !== "all" && (listing.status ?? "stable") !== status) return false;
      return true;
    }).sort((a, b) => {
      let value: number;
      if (sort === "providerName") value = a.providerName.localeCompare(b.providerName);
      else if (sort === "input") value = (unlistedPrice(a.cost) ? Number.POSITIVE_INFINITY : a.cost.input ?? Number.POSITIVE_INFINITY) - (unlistedPrice(b.cost) ? Number.POSITIVE_INFINITY : b.cost.input ?? Number.POSITIVE_INFINITY);
      else if (sort === "output") value = (unlistedPrice(a.cost) ? Number.POSITIVE_INFINITY : a.cost.output ?? Number.POSITIVE_INFINITY) - (unlistedPrice(b.cost) ? Number.POSITIVE_INFINITY : b.cost.output ?? Number.POSITIVE_INFINITY);
      else if (sort === "context") value = (a.limit.context ?? -1) - (b.limit.context ?? -1);
      else value = (a.lastUpdated ?? "").localeCompare(b.lastUpdated ?? "");
      return direction === "asc" ? value : -value;
    });
  }, [listings, q, status, sort, direction]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = rows.slice((current - 1) * pageSize, current * pageSize);

  function changeSort(next: typeof sort) {
    setDirection((value) => next === sort ? (value === "asc" ? "desc" : "asc") : next === "lastUpdated" || next === "context" ? "desc" : "asc");
    setSort(next);
    setPage(1);
  }

  return (
    <div className="data-table-shell">
      <div className="data-table-toolbar">
        <input type="search" className="input w-full sm:w-64" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Filter providers or variants…" aria-label="Filter provider listings" />
        <select className="input" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
          <option value="alpha">Alpha</option>
          <option value="deprecated">Deprecated</option>
        </select>
        <span className="ml-auto font-mono text-xs tabular-nums text-black/60">{rows.length} listings</span>
      </div>
      <div className="data-table-viewport">
      <table className="table-base min-w-[880px]">
        <thead>
          <tr>
            <SortableTh label="provider" active={sort === "providerName"} direction={direction} onSort={() => changeSort("providerName")}>Provider</SortableTh>
            <SortableTh label="input price" active={sort === "input"} direction={direction} onSort={() => changeSort("input")} align="right">Input /M</SortableTh>
            <SortableTh label="output price" active={sort === "output"} direction={direction} onSort={() => changeSort("output")} align="right">Output /M</SortableTh>
            <th className="text-right">Cache read /M</th>
            <th className="text-right">Cache write /M</th>
            <SortableTh label="context" active={sort === "context"} direction={direction} onSort={() => changeSort("context")} align="right">Context</SortableTh>
            <th>Capabilities</th>
            <th>Status</th>
            <SortableTh label="updated date" active={sort === "lastUpdated"} direction={direction} onSort={() => changeSort("lastUpdated")}>Updated</SortableTh>
          </tr>
        </thead>
        <tbody>
          {paged.map((l) => {
            const unlisted = unlistedPrice(l.cost);
            return (
              <tr key={l.key}>
                <td>
                  <Link
                    href={`/provider/${l.providerId}`}
                    className="font-medium text-black transition-colors hover:text-accent"
                  >
                    {l.providerName}
                  </Link>
                  {(variantsByProvider.get(l.providerId) ?? 0) > 1 && (
                    <Badge tone="muted" className="ml-2">
                      variant
                    </Badge>
                  )}
                  <div className="font-mono text-xs text-black/60">{l.modelId}</div>
                </td>
                <td className="text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-black/60">—</span> : fmtPerM(l.cost.input)}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-black/60">—</span> : fmtPerM(l.cost.output)}
                </td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheRead)}</td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheWrite)}</td>
                <td className="text-right font-mono tabular-nums">{fmtTokens(l.limit.context)}</td>
                <td>
                  <CapabilityBadges listing={l} />
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td className="whitespace-nowrap text-xs text-black/60">{fmtDate(l.lastUpdated)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <EmptyTableRow colSpan={9}>No provider listings match these filters.</EmptyTableRow>}
        </tbody>
      </table>
      </div>
      <TablePager page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} noun="listings" />
    </div>
  );
}
