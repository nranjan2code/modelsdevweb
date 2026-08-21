import Link from "next/link";
import type { Listing } from "@/lib/pipeline/types";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";
import { unlistedPrice } from "@/lib/pipeline/normalize";

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
        <span
          key={label}
          className={
            on
              ? "rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              : "rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] text-black/35"
          }
        >
          {on ? label : `no ${label}`}
        </span>
      ))}
    </span>
  );
}

export function StatusBadge({ status }: { status: Listing["status"] }) {
  if (!status) return null;
  const cls =
    status === "deprecated"
      ? "border-red-500/30 bg-red-50 text-red-600"
      : status === "beta"
        ? "border-amber-600/40 bg-amber-50 text-amber-700"
        : "border-blue-600/30 bg-blue-50 text-blue-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export function PriceTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table-base min-w-[760px]">
        <thead>
          <tr>
            <th>Provider</th>
            <th className="text-right">Input /M</th>
            <th className="text-right">Output /M</th>
            <th className="text-right">Cache read /M</th>
            <th className="text-right">Context</th>
            <th>Capabilities</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => {
            const unlisted = unlistedPrice(l.cost);
            return (
              <tr key={l.key}>
                <td>
                  <Link
                    href={`/provider/${l.providerId}`}
                    className="font-medium text-black transition-colors hover:text-blue-600"
                  >
                    {l.providerName}
                  </Link>
                  <div className="font-mono text-xs text-black/45">{l.modelId}</div>
                </td>
                <td className="text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-black/30">—</span> : fmtPerM(l.cost.input)}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-black/30">—</span> : fmtPerM(l.cost.output)}
                </td>
                <td className="text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheRead)}</td>
                <td className="text-right font-mono tabular-nums">{fmtTokens(l.limit.context)}</td>
                <td>
                  <CapabilityBadges listing={l} />
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td className="whitespace-nowrap text-xs text-black/45">{fmtDate(l.lastUpdated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
