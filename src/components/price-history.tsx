import type { PricePoint } from "@/lib/data/history";
import { fmtPerM } from "@/lib/format";

export function Sparkline({ values, width = 160, height = 40 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
  const falling = values[values.length - 1] <= values[0];
  const color = falling ? "#34d399" : "#f87171";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill={color} />
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
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-100">Best price history</h2>
      <div className="card flex flex-wrap items-center gap-6 p-5">
        <Sparkline values={priced.map((p) => p.input!)} />
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-zinc-100">{fmtPerM(last.input)}</span>
            <span className={`font-mono tabular-nums ${delta <= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {delta <= 0 ? "▼" : "▲"} {Math.abs(pctChange * 100).toFixed(1)}%
            </span>
            <span className="text-zinc-500">best input /M since {first.date}</span>
          </div>
          <div className="text-xs text-zinc-500">
            {first.providers} → {last.providers} live providers · {priced.length} snapshots
          </div>
        </div>
      </div>
    </section>
  );
}
