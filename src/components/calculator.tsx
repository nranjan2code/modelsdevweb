"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPerM } from "@/lib/format";

export interface CalcRow {
  id: string;
  name: string;
  lab: string;
  input: number;
  output: number;
  cacheRead: number | null;
}

export function Calculator({ rows }: { rows: CalcRow[] }) {
  const [inM, setInM] = useState(20);
  const [outM, setOutM] = useState(3);
  const [hitPct, setHitPct] = useState(60);
  const [q, setQ] = useState("");

  const hit = hitPct / 100;

  const priced = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .map((r) => {
        const cacheRead = r.cacheRead ?? r.input;
        const monthly = inM * (1 - hit) * r.input + inM * hit * cacheRead + outM * r.output;
        return { ...r, monthly };
      })
      .filter((r) => !needle || `${r.name} ${r.id}`.toLowerCase().includes(needle))
      .sort((a, b) => a.monthly - b.monthly);
  }, [rows, inM, outM, hit, q]);

  const max = priced.length > 0 ? priced[priced.length - 1].monthly : 1;

  return (
    <div className="space-y-5">
      <div className="card grid gap-6 p-5 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">
          <span className="flex justify-between text-black/60">
            Input tokens / month <b className="font-mono text-black">{inM}M</b>
          </span>
          <input type="range" min={0.1} max={500} step={0.1} value={inM} onChange={(e) => setInM(Number(e.target.value))} className="w-full accent-accent" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="flex justify-between text-black/60">
            Output tokens / month <b className="font-mono text-black">{outM}M</b>
          </span>
          <input type="range" min={0.1} max={100} step={0.1} value={outM} onChange={(e) => setOutM(Number(e.target.value))} className="w-full accent-accent" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span className="flex justify-between text-black/60">
            Cache hit rate <b className="font-mono text-black">{hitPct}%</b>
          </span>
          <input type="range" min={0} max={95} step={5} value={hitPct} onChange={(e) => setHitPct(Number(e.target.value))} className="w-full accent-accent" />
        </label>
      </div>

      <input className="input w-56" placeholder="Filter models…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[680px]">
          <thead>
            <tr>
              <th>#</th>
              <th>Model</th>
              <th className="text-right">Est. monthly</th>
              <th>Relative</th>
              <th className="text-right">In / Out per M</th>
            </tr>
          </thead>
          <tbody>
            {priced.slice(0, 30).map((r, i) => (
              <tr key={r.id}>
                <td className="tabular-nums text-black/45">{i + 1}</td>
                <td>
                  <Link href={`/m/${r.id}`} className="font-medium transition-colors hover:text-accent">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-black/45">{r.lab}</span>
                </td>
                <td className="text-right font-mono font-semibold tabular-nums text-black">
                  ${r.monthly < 1 ? r.monthly.toFixed(2) : r.monthly.toFixed(0)}
                </td>
                <td className="w-40">
                  <div className="h-2 overflow-hidden rounded-sm border border-black bg-white">
                    <div className="h-full bg-accent" style={{ width: `${Math.max(2, (r.monthly / max) * 100)}%` }} />
                  </div>
                </td>
                <td className="whitespace-nowrap text-right font-mono tabular-nums text-black/60">
                  {fmtPerM(r.input)} / {fmtPerM(r.output)}
                </td>
              </tr>
            ))}
            {priced.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-black/45">
                  No models match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-black/45">
        Estimate uses each model&apos;s cheapest listed provider. Cache-hit spend is billed at the
        provider&apos;s cache-read rate when published, otherwise at the input rate.
      </p>
    </div>
  );
}
