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
      <div className="card grid gap-5 p-5 sm:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="flex justify-between text-zinc-400">
            Input tokens / month <b className="font-mono text-zinc-100">{inM}M</b>
          </span>
          <input type="range" min={0.1} max={500} step={0.1} value={inM} onChange={(e) => setInM(Number(e.target.value))} className="w-full accent-emerald-500" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="flex justify-between text-zinc-400">
            Output tokens / month <b className="font-mono text-zinc-100">{outM}M</b>
          </span>
          <input type="range" min={0.1} max={100} step={0.1} value={outM} onChange={(e) => setOutM(Number(e.target.value))} className="w-full accent-emerald-500" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="flex justify-between text-zinc-400">
            Cache hit rate <b className="font-mono text-zinc-100">{hitPct}%</b>
          </span>
          <input type="range" min={0} max={95} step={5} value={hitPct} onChange={(e) => setHitPct(Number(e.target.value))} className="w-full accent-emerald-500" />
        </label>
      </div>

      <input className="input w-56" placeholder="Filter models…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium text-right">Est. monthly</th>
              <th className="px-4 py-3 font-medium">Relative</th>
              <th className="px-4 py-3 font-medium text-right">In / Out per M</th>
            </tr>
          </thead>
          <tbody>
            {priced.slice(0, 30).map((r, i) => (
              <tr key={r.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/50">
                <td className="px-4 py-2.5 tabular-nums text-zinc-500">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/m/${r.id}`} className="hover:text-emerald-400 transition-colors">
                    {r.name}
                  </Link>
                  <span className="ml-2 text-xs text-zinc-500">{r.lab}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                  ${r.monthly < 1 ? r.monthly.toFixed(2) : r.monthly.toFixed(0)}
                </td>
                <td className="px-4 py-2.5 w-40">
                  <div className="h-1.5 rounded bg-emerald-500/70" style={{ width: `${Math.max(2, (r.monthly / max) * 100)}%` }} />
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                  {fmtPerM(r.input)} / {fmtPerM(r.output)}
                </td>
              </tr>
            ))}
            {priced.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No models match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">
        Estimate uses each model&apos;s cheapest listed provider. Cache-hit spend is billed at the
        provider&apos;s cache-read rate when published, otherwise at the input rate.
      </p>
    </div>
  );
}
