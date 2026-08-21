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
              ? "rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-400"
              : "rounded bg-zinc-800/60 px-1.5 py-0.5 text-[11px] text-zinc-600"
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
      ? "bg-red-500/10 text-red-400"
      : status === "beta"
        ? "bg-amber-500/10 text-amber-300"
        : "bg-sky-500/10 text-sky-300";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{status}</span>;
}

export function PriceTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3 font-medium">Provider</th>
            <th className="px-4 py-3 font-medium text-right">Input /M</th>
            <th className="px-4 py-3 font-medium text-right">Output /M</th>
            <th className="px-4 py-3 font-medium text-right">Cache read /M</th>
            <th className="px-4 py-3 font-medium text-right">Context</th>
            <th className="px-4 py-3 font-medium">Capabilities</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => {
            const unlisted = unlistedPrice(l.cost);
            return (
              <tr key={l.key} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-100">{l.providerName}</div>
                  <div className="text-xs text-zinc-500">{l.modelId}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-zinc-500">—</span> : fmtPerM(l.cost.input)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-zinc-500">—</span> : fmtPerM(l.cost.output)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtPerM(l.cost.cacheRead)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtTokens(l.limit.context)}</td>
                <td className="px-4 py-3">
                  <CapabilityBadges listing={l} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(l.lastUpdated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
