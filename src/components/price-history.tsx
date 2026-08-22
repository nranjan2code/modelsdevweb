import type { PricePoint } from "@/lib/data/history";
import { fmtPerM } from "@/lib/format";
import { DeltaChip } from "@/components/ui";

export function Sparkline({ values, width = 160, height = 40 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
  // Falling is good here — pos/neg per docs/brand.md §3.2.
  const color = values[values.length - 1] <= values[0] ? "var(--color-pos)" : "var(--color-neg)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3" fill={color} />
    </svg>
  );
}

export function PriceHistory({ points }: { points: PricePoint[] }) {
  const priced = points.filter((p) => p.input != null);
  if (priced.length < 2) return null;
  const first = priced[0];
  const last = priced[priced.length - 1];
  const delta = last.input! - first.input!;
  const pctChange = first.input! > 0 ? delta / first.input! : 0;
  return (
    <section className="space-y-4">
      <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Best price history</h2>
      <div className="card flex flex-wrap items-center gap-6 p-5">
        <Sparkline values={priced.map((p) => p.input!)} />
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold tabular-nums text-black">{fmtPerM(last.input)}</span>
            <span className="scale-90">
              <DeltaChip down={delta <= 0} pct={pctChange} />
            </span>
            <span className="text-black/45">best input /M since {first.date}</span>
          </div>
          <div className="text-xs text-black/45">
            {first.providers} → {last.providers} live providers · {priced.length} snapshots
          </div>
        </div>
      </div>
    </section>
  );
}
