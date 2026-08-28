"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPerM, fmtTokens } from "@/lib/format";
import { paretoFrontier, paretoPrice, type ParetoBasis } from "@/lib/data/pareto";

export interface ContextPricePoint {
  id: string;
  name: string;
  lab: string;
  input: number;
  output: number;
  context: number;
  open: boolean;
  providers: number;
  textInput: boolean;
  textOutput: boolean;
}

type PriceBasis = ParetoBasis;
type WeightSlice = "all" | "open" | "closed";
type WorkloadSlice = "text" | "all";

const W = 860;
const H = 410;
const ML = 62;
const MR = 20;
const MT = 30;
const MB = 48;
const PRICE_FLOOR = 0.001;
const CONTEXT_FLOOR = 4_000;
const X_TICKS = [0, 0.03, 0.25, 1, 3, 30, 300];
const Y_TICKS = [8_000, 32_000, 128_000, 1_048_576, 2_097_152];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function basisLabel(basis: PriceBasis): string {
  if (basis === "input") return "Input price";
  if (basis === "output") return "Output price";
  return "Blended price";
}

function ChartTooltip({
  point,
  x,
  y,
  basis,
}: {
  point: ContextPricePoint;
  x: number;
  y: number;
  basis: PriceBasis;
}) {
  const boxX = x > W - 250 ? x - 224 : x + 12;
  const boxY = y < 130 ? y + 12 : y - 120;
  return (
    <g pointerEvents="none">
      <rect x={boxX} y={boxY} width="212" height="108" rx="6" fill="var(--color-ink)" />
      <text x={boxX + 12} y={boxY + 20} fill="var(--color-surface)" fontSize="12" fontWeight="700" fontFamily="var(--font-sans)">{point.name.slice(0, 28)}</text>
      <text x={boxX + 12} y={boxY + 39} fill="var(--color-surface)" opacity="0.72" fontSize="10.5" fontFamily="var(--font-mono)">{point.lab} · {point.providers} providers</text>
      <text x={boxX + 12} y={boxY + 58} fill="var(--color-surface)" fontSize="11" fontFamily="var(--font-mono)">in {fmtPerM(point.input)} · out {fmtPerM(point.output)} /M</text>
      <text x={boxX + 12} y={boxY + 76} fill="var(--color-surface)" fontSize="11" fontFamily="var(--font-mono)">{basisLabel(basis)} {fmtPerM(paretoPrice(point, basis))}/M</text>
      <text x={boxX + 12} y={boxY + 94} fill="var(--color-surface)" fontSize="11" fontFamily="var(--font-mono)">{fmtTokens(point.context)} context · {point.open ? "open weights" : "hosted"}</text>
    </g>
  );
}

export function ContextPriceChart({ points }: { points: ContextPricePoint[] }) {
  const [basis, setBasis] = useState<PriceBasis>("blended");
  const [weights, setWeights] = useState<WeightSlice>("all");
  const [workload, setWorkload] = useState<WorkloadSlice>("text");
  const [lab, setLab] = useState("all");
  const [priceCeiling, setPriceCeiling] = useState("all");
  const [contextFloor, setContextFloor] = useState("0");
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const labs = useMemo(() => [...new Set(points.map((point) => point.lab))].sort(), [points]);
  const filtered = useMemo(() => points.filter((point) => {
    if (workload === "text" && (!point.textInput || !point.textOutput)) return false;
    if (weights === "open" && !point.open) return false;
    if (weights === "closed" && point.open) return false;
    if (lab !== "all" && point.lab !== lab) return false;
    if (priceCeiling !== "all" && paretoPrice(point, basis) > Number(priceCeiling)) return false;
    if (point.context < Number(contextFloor)) return false;
    return true;
  }), [basis, contextFloor, lab, points, priceCeiling, weights, workload]);

  const frontier = useMemo(() => paretoFrontier(filtered, basis), [basis, filtered]);
  const frontierIds = useMemo(() => new Set(frontier.map((point) => point.id)), [frontier]);
  const selected = filtered.find((point) => point.id === selectedId) ?? null;
  const hovered = filtered.find((point) => point.id === hoveredId) ?? null;

  const dataMaxPrice = Math.max(...filtered.map((point) => paretoPrice(point, basis)), 300);
  const dataMaxContext = Math.max(...filtered.map((point) => point.context), 2_100_000);
  const fullXMin = Math.log10(PRICE_FLOOR);
  const fullXMax = Math.log10(dataMaxPrice * 1.05);
  const fullYMin = Math.log10(CONTEXT_FLOOR);
  const fullYMax = Math.log10(dataMaxContext * 1.05);
  const xCenter = selected ? Math.log10(Math.max(paretoPrice(selected, basis), PRICE_FLOOR)) : (fullXMin + fullXMax) / 2;
  const yCenter = selected ? Math.log10(Math.max(selected.context, CONTEXT_FLOOR)) : (fullYMin + fullYMax) / 2;
  const xSpan = (fullXMax - fullXMin) / zoom;
  const ySpan = (fullYMax - fullYMin) / zoom;
  const xMin = clamp(xCenter - xSpan / 2, fullXMin, fullXMax - xSpan);
  const xMax = xMin + xSpan;
  const yMin = clamp(yCenter - ySpan / 2, fullYMin, fullYMax - ySpan);
  const yMax = yMin + ySpan;
  const sx = (value: number) => Number((ML + ((Math.log10(Math.max(value, PRICE_FLOOR)) - xMin) / (xMax - xMin)) * (W - ML - MR)).toFixed(3));
  const sy = (value: number) => Number((H - MB - ((Math.log10(Math.max(value, CONTEXT_FLOOR)) - yMin) / (yMax - yMin)) * (H - MB - MT)).toFixed(3));
  const visible = filtered.filter((point) => {
    const x = Math.log10(Math.max(paretoPrice(point, basis), PRICE_FLOOR));
    const y = Math.log10(Math.max(point.context, CONTEXT_FLOOR));
    return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
  });
  const visibleFrontier = frontier.filter((point) => visible.some((item) => item.id === point.id));
  const frontierLine = visibleFrontier.map((point) => `${sx(paretoPrice(point, basis)).toFixed(1)},${sy(point.context).toFixed(1)}`).join(" ");
  const activePoint = hovered ?? selected;

  function reset(): void {
    setBasis("blended");
    setWeights("all");
    setWorkload("text");
    setLab("all");
    setPriceCeiling("all");
    setContextFloor("0");
    setZoom(1);
    setSelectedId(null);
  }

  return (
    <div className="chart-workbench card overflow-hidden">
      <aside className="chart-control-rail" aria-label="Chart controls">
        <div className="chart-control-heading">
          <div>
            <p className="mono-label">Explore the field</p>
            <p className="mt-1 text-sm font-semibold">Configure the view</p>
          </div>
          <button type="button" onClick={reset} className="chart-reset">Reset</button>
        </div>

        <fieldset className="chart-control-group min-w-0">
          <legend className="micro-label mb-2">Price basis</legend>
          <div className="grid grid-cols-3 rounded-md border border-black/15 bg-white p-1">
              {(["input", "output", "blended"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setBasis(value)} aria-pressed={basis === value} className="control-button min-h-9 rounded px-2 text-xs">
                  {value === "blended" ? "Blend 75/25" : value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
          </div>
        </fieldset>

        <div className="chart-control-group">
          <p className="micro-label mb-2">Slice</p>
          <div className="chart-filter-grid">
            <label className="block chart-filter-wide"><span className="micro-label mb-1 block">Lab</span><select className="input w-full" value={lab} onChange={(event) => setLab(event.target.value)}><option value="all">All labs</option>{labs.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="block"><span className="micro-label mb-1 block">Weights</span><select className="input w-full" value={weights} onChange={(event) => setWeights(event.target.value as WeightSlice)}><option value="all">All models</option><option value="open">Open only</option><option value="closed">Hosted only</option></select></label>
            <label className="block"><span className="micro-label mb-1 block">Workload</span><select className="input w-full" value={workload} onChange={(event) => setWorkload(event.target.value as WorkloadSlice)}><option value="text">Text generation</option><option value="all">All token-priced</option></select></label>
          </div>
        </div>

        <div className="chart-control-group">
          <p className="micro-label mb-2">Limits</p>
          <div className="chart-filter-grid">
            <label className="block"><span className="micro-label mb-1 block">Price</span><select className="input w-full" value={priceCeiling} onChange={(event) => setPriceCeiling(event.target.value)}><option value="all">Any price</option><option value="1">≤ $1/M</option><option value="3">≤ $3/M</option><option value="10">≤ $10/M</option></select></label>
            <label className="block"><span className="micro-label mb-1 block">Context</span><select className="input w-full" value={contextFloor} onChange={(event) => setContextFloor(event.target.value)}><option value="0">Any context</option><option value="131072">≥ 128K</option><option value="1048576">≥ 1M</option></select></label>
          </div>
        </div>

        <p className="chart-method-note">Blended price weights input 75% and output 25%. The frontier recomputes for every active slice.</p>
      </aside>

      <div className="chart-workspace">
        <div className="chart-utility-bar">
          <div><strong className="font-mono text-sm tabular-nums">{visible.length}</strong><span className="text-sm text-black/60"> visible · </span><strong className="font-mono text-sm tabular-nums text-warn">{visibleFrontier.length}</strong><span className="text-sm text-black/60"> Pareto-efficient</span></div>
          <div className="flex items-center gap-1" aria-label="Chart zoom">
            <button type="button" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom((value) => Math.max(1, value / 2))} className="control-button h-9 w-9 px-0 font-mono">−</button>
            <span className="min-w-12 text-center font-mono text-xs tabular-nums">{zoom}×</span>
            <button type="button" aria-label="Zoom in" disabled={zoom === 4} onClick={() => setZoom((value) => Math.min(4, value * 2))} className="control-button h-9 w-9 px-0 font-mono">+</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card-dashed p-6 text-sm text-black/60">No models match this slice. Reset the view or widen one of the filters.</div>
        ) : (
          <div className="chart-scroll">
            <svg viewBox={`0 0 ${W} ${H}`} className="chart-canvas w-full" role="img" aria-labelledby="pareto-title pareto-desc">
              <title id="pareto-title">Interactive model price and context Pareto chart</title>
              <desc id="pareto-desc">Dots farther left are cheaper and dots higher up have more context. The ochre line connects models not dominated on both price and context for the active filters.</desc>
              <defs><clipPath id="pareto-plot"><rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} /></clipPath></defs>
              {/*
                Price bands were three saturated background fills. They made the
                chart's loudest element the part carrying no data, while 300
                identical blue dots carried all of it. Boundaries are now thin
                rules with a label; colour belongs to the marks.
              */}
              <g clipPath="url(#pareto-plot)">
                {[128_000, 1_048_576].map((value) => <line key={value} x1={ML} y1={sy(value)} x2={W - MR} y2={sy(value)} stroke="var(--color-ink)" strokeOpacity="0.12" strokeDasharray="4 6" />)}
                {[0.25, 3].map((value) => <line key={value} x1={sx(value)} y1={MT} x2={sx(value)} y2={H - MB} stroke="var(--color-ink)" strokeOpacity="0.16" strokeDasharray="4 6" />)}
              </g>
              <text x={Math.max(ML + 32, sx(0.03))} y={MT + 16} textAnchor="middle" fontSize="10" fill="var(--color-ink)" fillOpacity="0.5" fontFamily="var(--font-mono)">budget</text>
              <text x={sx(1)} y={MT + 16} textAnchor="middle" fontSize="10" fill="var(--color-ink)" fillOpacity="0.5" fontFamily="var(--font-mono)">mainstream</text>
              <text x={Math.min(W - MR - 30, sx(30))} y={MT + 16} textAnchor="middle" fontSize="10" fill="var(--color-ink)" fillOpacity="0.5" fontFamily="var(--font-mono)">premium</text>
              <text x={W - MR - 8} y={clamp(sy(1_500_000), MT + 35, H - MB - 12)} textAnchor="end" fontSize="10" fill="var(--color-ink)" fillOpacity="0.56" fontFamily="var(--font-mono)">ultra context · ≥ 1M</text>
              <text x={W - MR - 8} y={clamp(sy(350_000), MT + 35, H - MB - 12)} textAnchor="end" fontSize="10" fill="var(--color-ink)" fillOpacity="0.56" fontFamily="var(--font-mono)">long context · 128K–1M</text>
              <text x={W - MR - 8} y={clamp(sy(32_000), MT + 35, H - MB - 12)} textAnchor="end" fontSize="10" fill="var(--color-ink)" fillOpacity="0.56" fontFamily="var(--font-mono)">standard context · &lt; 128K</text>
              {X_TICKS.filter((value) => { const log = Math.log10(Math.max(value, PRICE_FLOOR)); return log >= xMin && log <= xMax; }).map((value) => <g key={value}><line x1={sx(value)} y1={MT} x2={sx(value)} y2={H - MB} stroke="var(--color-ink)" strokeOpacity="0.09" /><text x={sx(value)} y={H - MB + 20} textAnchor="middle" fontSize="11" fill="var(--color-ink)" fillOpacity="0.68" fontFamily="var(--font-mono)">{fmtPerM(value)}</text></g>)}
              {Y_TICKS.filter((value) => { const log = Math.log10(value); return log >= yMin && log <= yMax; }).map((value) => <g key={value}><line x1={ML} y1={sy(value)} x2={W - MR} y2={sy(value)} stroke="var(--color-ink)" strokeOpacity="0.09" /><text x={ML - 9} y={sy(value) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink)" fillOpacity="0.68" fontFamily="var(--font-mono)">{fmtTokens(value)}</text></g>)}
              <line x1={ML} y1={H - MB} x2={W - MR} y2={H - MB} stroke="var(--color-ink)" strokeWidth="1.5" /><line x1={ML} y1={MT} x2={ML} y2={H - MB} stroke="var(--color-ink)" strokeWidth="1.5" />
              <text x={(W + ML) / 2} y={H - 9} textAnchor="middle" fontSize="12" fill="var(--color-ink)" fillOpacity="0.72" fontFamily="var(--font-sans)">cheaper ← {basisLabel(basis).toLowerCase()} per 1M tokens → pricier</text>
              <text x={15} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-ink)" fillOpacity="0.72" fontFamily="var(--font-sans)" transform={`rotate(-90 15 ${H / 2})`}>larger context window →</text>
              <g clipPath="url(#pareto-plot)">
                {frontierLine && <polyline points={frontierLine} fill="none" stroke="var(--color-warn)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 5" opacity="0.9" />}
                {visible.map((point) => {
                  const x = sx(paretoPrice(point, basis));
                  const y = sy(point.context);
                  const isFrontier = frontierIds.has(point.id);
                  const isSelected = point.id === selected?.id;
                  return <g key={point.id} role="button" tabIndex={0} aria-label={`${point.name}, ${fmtPerM(paretoPrice(point, basis))} per million, ${fmtTokens(point.context)} context`} onClick={() => setSelectedId(point.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(point.id); } }} onMouseEnter={() => setHoveredId(point.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(point.id)} onBlur={() => setHoveredId(null)} className="pareto-point cursor-pointer">
                    {(isFrontier || isSelected) && <circle cx={x} cy={y} r={isSelected ? 10 : 8} fill="none" stroke={isSelected ? "var(--color-accent)" : "var(--color-warn)"} strokeWidth={isSelected ? 2 : 1.5} className="pareto-halo" />}
                    {/*
                      Hundreds of models share the 128K and 1M context lines, so
                      raw dots fuse into a solid bar. A 2px surface ring on every
                      mark keeps neighbours legible at full density; hue carries
                      the one categorical fact worth encoding here.
                    */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 6 : 4.5}
                      fill={point.open ? "var(--color-special)" : "var(--color-accent)"}
                      stroke="var(--color-surface)"
                      strokeWidth="2"
                      opacity={isFrontier || isSelected ? 1 : 0.78}
                      className="pareto-dot"
                    />
                  </g>;
                })}
                {activePoint && <ChartTooltip point={activePoint} x={sx(paretoPrice(activePoint, basis))} y={sy(activePoint.context)} basis={basis} />}
              </g>
            </svg>
          </div>
        )}

        <div className="chart-legend">
          <span className="inline-flex items-center gap-2"><span className="chart-key" />Hosted weights</span>
          <span className="inline-flex items-center gap-2"><span className="chart-key chart-key-special" />Open weights</span>
          <span className="inline-flex items-center gap-2"><span className="chart-key chart-key-ring" />Pareto frontier</span>
          <span>Bands: budget ≤ $0.25 · mainstream $0.25–$3 · premium ≥ $3</span>
        </div>

        {selected ? (
          <div className="mt-4 grid gap-4 border-t border-black/10 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div><p className="mono-label">Selected model</p><h3 className="mt-1 text-lg font-bold">{selected.name}</h3><p className="mt-1 font-mono text-xs text-black/60">{selected.lab} · in {fmtPerM(selected.input)} · out {fmtPerM(selected.output)} · {fmtTokens(selected.context)} context · {selected.providers} providers</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={zoom === 4} onClick={() => setZoom((value) => Math.min(4, value * 2))} className="button-secondary disabled:opacity-40">{zoom === 4 ? "Maximum zoom" : "Zoom to model"}</button><Link href={`/m/${selected.id}`} className="button-primary">Open model →</Link></div>
          </div>
        ) : (
          <p className="mt-4 border-t border-black/10 pt-4 text-sm text-black/60">Select or focus a dot to pin its full input, output, context and provider details.</p>
        )}
      </div>
    </div>
  );
}
