"use client";

import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export function SortableTh({
  label,
  active,
  direction,
  onSort,
  align = "left",
  children,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  align?: "left" | "right";
  children?: ReactNode;
}) {
  return (
    <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} className={align === "right" ? "text-right" : undefined}>
      <button type="button" onClick={onSort} className={`table-sort ${align === "right" ? "justify-end" : "justify-start"}`}>
        <span>{children ?? label}</span>
        <span className={active ? "text-accent" : "text-black/60"} aria-hidden="true">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
        <span className="sr-only">Sort by {label}</span>
      </button>
    </th>
  );
}

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("…");
    out.push(page);
    previous = page;
  }
  return out;
}

export function TablePager({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  noun = "rows",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  noun?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  return (
    <div className="data-table-footer">
      <div className="flex flex-wrap items-center gap-3 text-xs text-black/60">
        <span className="font-mono tabular-nums">{start}–{end} of {total} {noun}</span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-2">Rows per page
            <select className="data-table-page-size" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {[20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <nav aria-label={`${noun} pagination`} className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Previous page" onClick={() => onPageChange(current - 1)} disabled={current === 1} className="table-page-button">←</button>
          {pageWindow(current, totalPages).map((item, index) => item === "…" ? <span key={`gap-${index}`} className="px-1 text-black/60">…</span> : (
            <button key={item} type="button" onClick={() => onPageChange(item)} aria-current={item === current ? "page" : undefined} className="table-page-button">{item}</button>
          ))}
          <button type="button" aria-label="Next page" onClick={() => onPageChange(current + 1)} disabled={current === totalPages} className="table-page-button">→</button>
        </nav>
      )}
    </div>
  );
}

export function EmptyTableRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="py-12 text-center text-sm text-black/60">{children}</td></tr>;
}
