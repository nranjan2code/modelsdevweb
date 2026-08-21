import type { Metadata } from "next";
import Link from "next/link";
import { blendPrice, getCatalog, getEvents, groupContext } from "@/lib/data";
import { capabilityAdoption, priceBuckets } from "@/lib/data/stats";
import type { Event } from "@/lib/pipeline/types";
import { EventTypeBadge } from "@/components/event-card";

export const metadata: Metadata = {
  title: "Market trends",
  description: "Aggregate market view of AI models: capability adoption, price distributions, median prices by lab and recent repricings.",
  alternates: { canonical: "/trends" },
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function Bar({ pct, color = "bg-blue-600" }: { pct: number; color?: string }) {
  return (
    <div className="h-2 min-w-6 flex-1 overflow-hidden rounded-sm border border-black bg-white">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(1, Math.min(100, pct * 100))}%` }} />
    </div>
  );
}

const CTX_TICKS = [
  { v: 8_000, label: "8K" },
  { v: 131_072, label: "128K" },
  { v: 1_048_576, label: "1M" },
];
const PRICE_TICKS = [
  { v: 0.03, label: "$0.03" },
  { v: 1, label: "$1" },
  { v: 30, label: "$30" },
];

function Scatter({ points }: { points: { key: string; x: number; y: number; open: boolean; name: string }[] }) {
  const W = 760;
  const H = 380;
  const ML = 56;
  const MB = 44;
  const MT = 16;
  const MR = 16;
  const xMin = Math.log10(0.01);
  const xMax = Math.log10(300);
  const yMin = Math.log10(4_000);
  const yMax = Math.log10(2_100_000);
  const sx = (v: number) => ML + ((Math.log10(Math.max(v, 0.01)) - xMin) / (xMax - xMin)) * (W - ML - MR);
  const sy = (v: number) => H - MB - ((Math.log10(Math.max(v, 4_000)) - yMin) / (yMax - yMin)) * (H - MB - MT);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Context window versus blended input-output price, log scale">
      {PRICE_TICKS.map((t) => (
        <g key={t.label}>
          <line x1={sx(t.v)} y1={MT} x2={sx(t.v)} y2={H - MB} stroke="rgba(0,0,0,0.08)" />
          <text x={sx(t.v)} y={H - MB + 18} textAnchor="middle" fontSize="11" fill="rgba(0,0,0,0.45)" fontFamily="var(--font-mono)">
            {t.label}
          </text>
        </g>
      ))}
      {CTX_TICKS.map((t) => (
        <g key={t.label}>
          <line x1={ML} y1={sy(t.v)} x2={W - MR} y2={sy(t.v)} stroke="rgba(0,0,0,0.08)" />
          <text x={ML - 8} y={sy(t.v) + 4} textAnchor="end" fontSize="11" fill="rgba(0,0,0,0.45)" fontFamily="var(--font-mono)">
            {t.label}
          </text>
        </g>
      ))}
      <line x1={ML} y1={H - MB} x2={W - MR} y2={H - MB} stroke="#0a0a0a" strokeWidth="1.5" />
      <line x1={ML} y1={MT} x2={ML} y2={H - MB} stroke="#0a0a0a" strokeWidth="1.5" />
      <text x={(W + ML) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.55)">
        best blended price /M (log)
      </text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="12" fill="rgba(0,0,0,0.55)" transform={`rotate(-90 14 ${H / 2})`}>
        context window (log)
      </text>
      {points.map((p) => (
        <circle key={p.key} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={p.open ? "#10b981" : "#2563eb"} opacity={0.55}>
          <title>{`${p.name} — $${p.x.toFixed(2)}/M blended`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default async function TrendsPage() {
  const [catalog, events] = await Promise.all([getCatalog(), getEvents()]);
  const groups = catalog.groups;

  const caps = capabilityAdoption(groups);

  const buckets = priceBuckets(groups);
  const bucketMax = Math.max(...buckets.map((b) => b.count), 1);

  const labStats = catalog.labs
    .map((lab) => {
      const gs = groups.filter((g) => g.labId === lab.id && g.best != null);
      return {
        labId: lab.id,
        count: gs.length,
        medIn: median(gs.map((g) => g.best!.input)),
        medOut: median(gs.map((g) => g.best!.output)),
      };
    })
    .filter((s) => s.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const medMax = Math.max(...labStats.map((s) => Math.max(s.medIn ?? 0, s.medOut ?? 0)), 0.001);

  const priced = groups.filter((g) => g.best != null);
  const scatter = priced
    .filter((g) => (groupContext(g) ?? 0) > 0)
    .map((g) => ({
      key: g.id,
      x: blendPrice(g.best!.input, g.best!.output),
      y: groupContext(g) ?? 0,
      open: g.canonical?.openWeights === true,
      name: g.name,
    }));

  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  const types = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const typeMax = Math.max(...types.map(([, c]) => c), 1);

  const repricedLabs = new Map<string, number>();
  const repricedModels = new Map<string, { name: string; id: string | null; count: number }>();
  for (const e of events as Event[]) {
    if (e.type !== "repriced") continue;
    if (e.labId) repricedLabs.set(e.labId, (repricedLabs.get(e.labId) ?? 0) + 1);
    if (e.canonicalId) {
      const cur = repricedModels.get(e.canonicalId);
      repricedModels.set(e.canonicalId, { name: e.modelName, id: e.canonicalId, count: (cur?.count ?? 0) + 1 });
    }
  }
  const hotModels = [...repricedModels.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <p className="mono-label">State of the market</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Trends</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/55">
          Aggregate view of the {groups.length}-model catalog: what capabilities are standard, where prices sit,
          which labs charge what, and what has been moving lately. Computed at build time from the same open
          snapshot as every other page.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Capability adoption</h2>
          <ul className="card space-y-3 p-4">
            {caps.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="w-28 shrink-0 truncate text-black/60 sm:w-36">{c.label}</span>
                <Bar pct={c.pct} />
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-black/70 sm:w-20">
                  {c.count} · {Math.round(c.pct * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Price distribution</h2>
          <div className="card p-4">
            <div className="mono-label mb-3">blended price /M · {priced.length} priced models</div>
            <ul className="space-y-2.5">
              {buckets.map((b) => (
                <li key={b.label} className="flex items-center gap-2 text-sm sm:gap-3">
                  <span className="w-20 shrink-0 font-mono text-xs text-black/60">{b.label}</span>
                  <Bar pct={b.count / bucketMax} />
                  <span className="w-8 shrink-0 text-right font-mono tabular-nums text-black/70">{b.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Median prices by lab</h2>
        <p className="text-sm text-black/50">Labs with ≥ 3 priced models. Bars scaled to the most expensive median.</p>
        <ul className="card space-y-3 p-4">
          {labStats.map((s) => (
            <li key={s.labId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/lab/${s.labId}`} className="w-28 shrink-0 truncate font-medium transition-colors hover:text-blue-600">
                {s.labId}
              </Link>
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <Bar pct={(s.medIn ?? 0) / medMax} />
                <span className="shrink-0 font-mono text-xs tabular-nums text-black/70">
                  in {s.medIn != null ? `$${s.medIn.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex min-w-48 flex-1 items-center gap-2">
                <Bar pct={(s.medOut ?? 0) / medMax} color="bg-purple-500" />
                <span className="shrink-0 font-mono text-xs tabular-nums text-black/70">
                  out {s.medOut != null ? `$${s.medOut.toFixed(2)}` : "—"}
                </span>
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-black/40">{s.count} mod.</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Context vs price</h2>
        <p className="text-sm text-black/50">
          Each dot is one priced model with a known context window. Green dots are open-weights models — the
          frontier of cheap-and-large lives mostly on that side.
        </p>
        <div className="card p-4">
          <Scatter points={scatter} />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Change pulse</h2>
          <ul className="card space-y-2.5 p-4">
            {events.length === 0 ? (
              <li className="text-sm text-black/45">No events recorded yet — the hourly diff just started collecting.</li>
            ) : (
              types.map(([type, count]) => (
                <li key={type} className="flex items-center gap-3 text-sm">
                  <EventTypeBadge type={type as Event["type"]} />
                  <Bar pct={count / typeMax} color="bg-black/60" />
                  <span className="w-8 shrink-0 text-right font-mono tabular-nums text-black/70">{count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Most repriced models</h2>
          <ul className="card divide-y divide-black/10 text-sm">
            {hotModels.length === 0 ? (
              <li className="px-4 py-3 text-black/45">No repricings detected yet.</li>
            ) : (
              hotModels.map((m) => (
                <li key={m.id ?? m.name} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  {m.id ? (
                    <Link href={`/m/${m.id}`} className="truncate font-medium transition-colors hover:text-blue-600">
                      {m.name}
                    </Link>
                  ) : (
                    <span className="truncate">{m.name}</span>
                  )}
                  <span className="shrink-0 font-mono text-xs tabular-nums text-purple-700">{m.count}×</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
