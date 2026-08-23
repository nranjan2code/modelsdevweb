"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COMPARE_MAX, compareUrl, peekCompare, readModelsParam, setCompare, toggleCompare, useCompareSelection } from "@/lib/compare";
import { benchmarkHome } from "@/lib/data/benchmark-links";
import { fmtPerM, fmtTokens, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui";

export interface CompareModel {
  id: string;
  name: string;
  lab: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  ctx: number | null;
  maxOut: number | null;
  reasoning: boolean;
  tools: boolean;
  structured: boolean;
  vision: boolean;
  audioIn: boolean;
  open: boolean | null;
  released: string | null;
  knowledge: string | null;
  providers: number;
  deprecated: number;
  benchmarks: Record<string, number>;
}

export type PackedCompareModel = [
  id: string,
  name: string,
  lab: string,
  input: number | null,
  output: number | null,
  cacheRead: number | null,
  ctx: number | null,
  maxOut: number | null,
  capabilities: number,
  open: boolean | null,
  released: string | null,
  knowledge: string | null,
  providers: number,
  deprecated: number,
  benchmarks: Record<string, number>,
];

function unpackModel(model: PackedCompareModel): CompareModel {
  const [id, name, lab, input, output, cacheRead, ctx, maxOut, capabilities, open, released, knowledge, providers, deprecated, benchmarks] = model;
  return {
    id, name, lab, input, output, cacheRead, ctx, maxOut, open, released, knowledge, providers, deprecated, benchmarks,
    reasoning: Boolean(capabilities & 1),
    tools: Boolean(capabilities & 2),
    structured: Boolean(capabilities & 4),
    vision: Boolean(capabilities & 8),
    audioIn: Boolean(capabilities & 16),
  };
}

function BoolCell({ v }: { v: boolean }) {
  return v ? (
    <span className="font-semibold text-pos">✓</span>
  ) : (
    <span className="text-black/60">✗</span>
  );
}

function Price({ v, best }: { v: number | null; best?: boolean }) {
  if (v == null) return <span className="text-black/60">—</span>;
  return (
    <span className={best ? "font-mono font-bold tabular-nums text-pos" : "font-mono tabular-nums"}>
      {fmtPerM(v)}
    </span>
  );
}

export function CompareBoard({ models: packedModels }: { models: PackedCompareModel[] }) {
  const models = useMemo(() => packedModels.map(unpackModel), [packedModels]);
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const selected = useCompareSelection();
  const [q, setQ] = useState("");

  useEffect(() => {
    const fromUrl = readModelsParam().filter((id) => byId.has(id));
    if (fromUrl.length > 0 && JSON.stringify(fromUrl) !== JSON.stringify(peekCompare())) {
      setCompare(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remove(id: string) {
    toggleCompare(id);
    const next = peekCompare();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", compareUrl(next) ?? window.location.pathname);
    }
  }

  function add(id: string) {
    toggleCompare(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", compareUrl(peekCompare()) ?? window.location.pathname);
    }
  }

  const chosen = selected.map((id) => byId.get(id)).filter((m): m is CompareModel => m != null);
  const needle = q.trim().toLowerCase();
  const suggestions = models
    .filter((m) => !selected.includes(m.id))
    .filter((m) => !needle || `${m.name} ${m.id} ${m.lab}`.toLowerCase().includes(needle))
    .sort((a, b) => b.providers - a.providers)
    .slice(0, 8);

  const minInput = Math.min(...chosen.map((m) => m.input ?? Number.POSITIVE_INFINITY));
  const minOutput = Math.min(...chosen.map((m) => m.output ?? Number.POSITIVE_INFINITY));
  const maxCtx = Math.max(...chosen.map((m) => m.ctx ?? 0));
  const benchNames = [...new Set(chosen.flatMap((m) => Object.keys(m.benchmarks)))].sort();

  const rows: { key: string; label: React.ReactNode; render: (m: CompareModel) => React.ReactNode }[] = [
    {
      key: "input",
      label: "Best input /M",
      render: (m) => <Price v={m.input} best={chosen.length > 1 && m.input != null && m.input === minInput} />,
    },
    {
      key: "output",
      label: "Best output /M",
      render: (m) => <Price v={m.output} best={chosen.length > 1 && m.output != null && m.output === minOutput} />,
    },
    { key: "cacheread", label: "Cache read /M", render: (m) => <Price v={m.cacheRead} /> },
    {
      key: "ctx",
      label: "Context window",
      render: (m) => (
        <span className={`font-mono tabular-nums ${chosen.length > 1 && (m.ctx ?? 0) === maxCtx && maxCtx > 0 ? "font-bold text-pos" : ""}`}>
          {fmtTokens(m.ctx)}
        </span>
      ),
    },
    { key: "maxout", label: "Max output", render: (m) => <span className="font-mono tabular-nums">{fmtTokens(m.maxOut)}</span> },
    {
      key: "providers",
      label: "Providers",
      render: (m) => (
        <span className="tabular-nums text-black/70">
          {m.providers}
          {m.deprecated > 0 && <span className="text-xs text-neg"> · {m.deprecated} dep</span>}
        </span>
      ),
    },
    { key: "released", label: "Released", render: (m) => <span className="whitespace-nowrap text-black/60">{fmtDate(m.released)}</span> },
    { key: "knowledge", label: "Knowledge cutoff", render: (m) => <span className="whitespace-nowrap text-black/60">{m.knowledge ?? "—"}</span> },
    {
      key: "weights",
      label: "Weights",
      render: (m) =>
        m.open ? <Badge tone="pos">open</Badge> : (
          <Badge tone="muted" bold={false} className="font-medium">
            closed
          </Badge>
        ),
    },
    { key: "reasoning", label: "Reasoning", render: (m) => <BoolCell v={m.reasoning} /> },
    { key: "tools", label: "Tool call", render: (m) => <BoolCell v={m.tools} /> },
    { key: "structured", label: "Structured output", render: (m) => <BoolCell v={m.structured} /> },
    { key: "vision", label: "Vision / attachments", render: (m) => <BoolCell v={m.vision} /> },
    { key: "audioin", label: "Audio input", render: (m) => <BoolCell v={m.audioIn} /> },
    ...benchNames.map((name) => ({
      key: name,
      label: (
        <span className="inline-flex items-center gap-1">
          {name}
          {benchmarkHome(name) && (
            <a
              href={benchmarkHome(name)!}
              target="_blank"
              rel="noreferrer"
              title={`Official ${name} benchmark`}
              className="micro-label normal-case tracking-normal text-accent hover:text-accent-strong"
            >
              ↗
            </a>
          )}
        </span>
      ),
      render: (m: CompareModel) =>
        m.benchmarks[name] != null ? (
          <span className="font-mono font-semibold tabular-nums">{m.benchmarks[name]}</span>
        ) : (
          <span className="text-black/60">—</span>
        ),
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mono-label mb-2">
          Add models <span className="normal-case tracking-normal">(up to {COMPARE_MAX}, stored in your browser)</span>
        </div>
        <input
          className="input w-full sm:w-72"
          placeholder="Search models to compare…"
          aria-label="Search models to compare"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {suggestions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => add(m.id)}
                  disabled={selected.length >= COMPARE_MAX}
                  className="inline-flex min-h-11 items-center rounded-full border border-black/15 bg-white px-3 py-2 text-xs font-medium text-black/70 transition-all enabled:hover:border-black enabled:hover:text-black disabled:opacity-40"
                >
                  + {m.name} <span className="text-black/60">{m.lab}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {suggestions.length === 0 && (
          <p className="mt-3 text-sm text-black/60">{needle ? "No models match." : "All models selected."}</p>
        )}
      </div>

      {chosen.length === 0 ? (
        <p className="card-dashed p-6 text-sm text-black/60">
          Pick models above — or hit “+ compare” on any row in{" "}
          <Link href="/browse" className="font-medium underline decoration-wavy underline-offset-4 hover:text-accent">
            Browse
          </Link>
          . Deep-link with <code className="font-mono text-xs">/compare?models=lab/model,lab/model2</code>.
        </p>
      ) : (
        <div className="data-table-shell">
          <div className="data-table-viewport">
          <table className="table-base w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="w-44">Attribute</th>
                {chosen.map((m) => (
                  <th key={m.id}>
                    <div className="flex items-center gap-1.5 whitespace-normal">
                      <Link href={`/m/${m.id}`} className="text-sm normal-case tracking-normal text-black hover:text-accent">
                        {m.name}
                      </Link>
                      <span className="shrink-0 text-xs text-black/60">{m.lab}</span>
                      <button
                        onClick={() => remove(m.id)}
                        aria-label={`Remove ${m.name}`}
                        className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-black/15 text-base text-black/60 transition-colors hover:border-neg hover:text-neg"
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="text-xs font-medium text-black/60">{row.label}</td>
                  {chosen.map((m) => (
                    <td key={m.id}>{row.render(m)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
