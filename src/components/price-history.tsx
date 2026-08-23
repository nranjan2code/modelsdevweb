import type { PricePoint } from "@/lib/data/history";
import { fmtDate, fmtPerM } from "@/lib/format";
import { Badge, DeltaChip } from "@/components/ui";

function pctChange(first: number, last: number): number {
  return first > 0 ? (last - first) / first : 0;
}

function PriceChart({ points }: { points: PricePoint[] }) {
  const W = 760;
  const H = 260;
  const ML = 58;
  const MR = 18;
  const MT = 18;
  const MB = 40;
  const innerW = W - ML - MR;
  const innerH = H - MT - MB;
  const maxPrice = Math.max(...points.flatMap((point) => [point.input ?? 0, point.output ?? 0]), 0.01);
  const chartMax = maxPrice * 1.08;
  const sx = (index: number) => ML + (index / Math.max(points.length - 1, 1)) * innerW;
  const sy = (value: number) => MT + innerH - (value / chartMax) * innerH;
  const inputPoints = points.filter((point) => point.input != null);
  const outputPoints = points.filter((point) => point.output != null);
  const line = (series: PricePoint[], pick: (point: PricePoint) => number | null) => series
    .map((point) => `${sx(points.indexOf(point)).toFixed(1)},${sy(pick(point)!).toFixed(1)}`)
    .join(" ");
  const inputLine = line(inputPoints, (point) => point.input);
  const outputLine = line(outputPoints, (point) => point.output);
  const yTicks = [0, chartMax / 2, chartMax];
  const xTicks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const firstInput = inputPoints[0];
  const lastInput = inputPoints[inputPoints.length - 1];
  const lastOutput = outputPoints[outputPoints.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-canvas w-full" role="img" aria-labelledby="price-chart-title price-chart-desc">
      <title id="price-chart-title">Best published input and output price history</title>
      <desc id="price-chart-desc">Daily lowest published price per one million tokens. Blue is input price and violet is output price. The vertical scale starts at zero.</desc>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={ML} y1={sy(tick)} x2={W - MR} y2={sy(tick)} stroke="rgba(0,0,0,0.08)" />
          <text x={ML - 8} y={sy(tick) + 4} textAnchor="end" fontSize="11" fill="rgba(0,0,0,0.65)" fontFamily="var(--font-mono)">
            {fmtPerM(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((index) => (
        <text key={index} x={sx(index)} y={H - 12} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fontSize="11" fill="rgba(0,0,0,0.65)" fontFamily="var(--font-mono)">
          {fmtDate(points[index].date)}
        </text>
      ))}
      <line x1={ML} y1={MT + innerH} x2={W - MR} y2={MT + innerH} stroke="var(--color-ink)" strokeWidth="1.25" />
      {inputPoints.length > 1 && (
        <>
          <polygon points={`${sx(points.indexOf(firstInput))},${MT + innerH} ${inputLine} ${sx(points.indexOf(lastInput))},${MT + innerH}`} fill="var(--color-accent-soft)" opacity="0.7" />
          <polyline points={inputLine} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={sx(points.indexOf(lastInput))} cy={sy(lastInput.input!)} r="4" fill="var(--color-accent)" />
        </>
      )}
      {outputPoints.length > 1 && (
        <>
          <polyline points={outputLine} fill="none" stroke="var(--color-special)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={sx(points.indexOf(lastOutput))} cy={sy(lastOutput.output!)} r="4" fill="var(--color-special)" />
        </>
      )}
    </svg>
  );
}

export function PriceHistory({ points }: { points: PricePoint[] }) {
  const priced = points.filter((point) => point.input != null);
  if (priced.length < 2) return null;
  const first = priced[0];
  const last = priced[priced.length - 1];
  const firstOutput = priced.find((point) => point.output != null)?.output ?? null;
  const lastOutput = [...priced].reverse().find((point) => point.output != null)?.output ?? null;
  const inputDelta = last.input! - first.input!;
  const outputDelta = firstOutput != null && lastOutput != null ? lastOutput - firstOutput : null;
  const hasMovement = inputDelta !== 0 || (outputDelta != null && outputDelta !== 0);

  return (
    <section className="space-y-4">
      <div className="border-b border-black/15 pb-3">
        <h2 className="font-hand text-3xl font-bold tracking-[-0.025em] text-black">Best price history</h2>
        <p className="mt-1 text-sm text-black/60">Daily lowest published price across live providers. A lower line is better for the buyer.</p>
      </div>
      <div className="card overflow-hidden">
        <dl className="grid border-b border-black/10 sm:grid-cols-3">
          <div className="p-4 sm:p-5">
            <dt className="micro-label">Best input /M</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-2"><strong className="font-mono text-xl tabular-nums">{fmtPerM(last.input)}</strong>{inputDelta === 0 ? <Badge tone="muted">unchanged</Badge> : <DeltaChip down={inputDelta < 0} pct={pctChange(first.input!, last.input!)} />}</dd>
          </div>
          <div className="border-t border-black/10 p-4 sm:border-l sm:border-t-0 sm:p-5">
            <dt className="micro-label">Best output /M</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-2"><strong className="font-mono text-xl tabular-nums">{fmtPerM(lastOutput)}</strong>{outputDelta === 0 ? <Badge tone="muted">unchanged</Badge> : outputDelta != null && firstOutput != null && <DeltaChip down={outputDelta < 0} pct={pctChange(firstOutput, lastOutput!)} />}</dd>
          </div>
          <div className="border-t border-black/10 p-4 sm:border-l sm:border-t-0 sm:p-5">
            <dt className="micro-label">Provider coverage</dt>
            <dd className="mt-2 font-mono text-xl font-bold tabular-nums">{last.providers}</dd>
            <dd className="text-xs text-black/60">{first.providers} at the start · {priced.length} snapshots</dd>
          </div>
        </dl>
        <div className="p-4 sm:p-5">
          {hasMovement ? (
            <>
              <div className="chart-scroll"><PriceChart points={priced} /></div>
              <div className="chart-legend">
                <span className="inline-flex items-center gap-2"><span className="chart-key" />Best input price</span>
                <span className="inline-flex items-center gap-2"><span className="chart-key chart-key-special" />Best output price</span>
                <span>{fmtDate(first.date)} → {fmtDate(last.date)}</span>
              </div>
            </>
          ) : (
            <div className="card-dashed p-5">
              <p className="font-semibold text-black">Published best prices are unchanged.</p>
              <p className="mt-1 text-sm text-black/60">{priced.length} daily snapshots collected from {fmtDate(first.date)} through {fmtDate(last.date)}. A price chart will appear after the first real move.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
