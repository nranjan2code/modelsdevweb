import Link from "next/link";
import type { Listing } from "@/lib/pipeline/types";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";
import { unlistedPrice } from "@/lib/pipeline/normalize";
import { Badge } from "@/components/ui";

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
  return (
    <div className="card overflow-x-auto">
      <table className="table-base min-w-[880px]">
        <thead>
          <tr>
            <th>Provider</th>
            <th className="text-right">Input /M</th>
            <th className="text-right">Output /M</th>
            <th className="text-right">Cache read /M</th>
            <th className="text-right">Cache write /M</th>
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
                    className="font-medium text-black transition-colors hover:text-accent"
                  >
                    {l.providerName}
                  </Link>
                  <div className="font-mono text-xs text-black/45">{l.modelId}</div>
                </td>
                <td className="text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-black/35">—</span> : fmtPerM(l.cost.input)}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {unlisted ? <span className="text-black/35">—</span> : fmtPerM(l.cost.output)}
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
                <td className="whitespace-nowrap text-xs text-black/45">{fmtDate(l.lastUpdated)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
