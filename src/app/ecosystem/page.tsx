import type { Metadata } from "next";
import Link from "next/link";
import { Badge, SectionHead } from "@/components/ui";
import { getEcosystemSnapshot } from "@/lib/ecosystem/data";
import { entitiesWithScores } from "@/lib/ecosystem/rankings";
import type { EcosystemEntityType } from "@/lib/ecosystem/types";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "AI ecosystem adoption",
  description: "Daily adoption and momentum signals for AI agents, applications, frameworks, infrastructure and tools.",
};

const TYPE_LABELS: Record<EcosystemEntityType, string> = {
  agent: "Agents",
  application: "Applications",
  framework: "Frameworks",
  infrastructure: "Infrastructure",
  tool: "Tools",
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function EcosystemPage() {
  const snapshot = await getEcosystemSnapshot();
  const rows = entitiesWithScores(snapshot.entities, snapshot.scores)
    .filter((entity) => entity.score)
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));
  const grouped = (Object.keys(TYPE_LABELS) as EcosystemEntityType[]).map((type) => ({
    type,
    rows: rows.filter((entity) => entity.type === type),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-10 lg:space-y-14">
      <header className="page-intro page-intro-split">
        <p className="mono-label text-accent">Daily ecosystem watch</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">What developers are building with AI.</h1>
        <div className="max-w-2xl text-sm leading-relaxed text-black/60">
          <p>
          Adoption signals for public AI projects, measured from GitHub activity and npm usage where those signals are available. Popularity and momentum are separate readings.
          </p>
          <p className="micro-label mt-4">Last collected {snapshot.date ? fmtDate(snapshot.date) : "not yet collected"} · {snapshot.signals.length} source signals · {snapshot.entities.length} tracked entities</p>
        </div>
      </header>

      {grouped.map(({ type, rows: groupRows }) => (
        <section key={type}>
          <SectionHead title={TYPE_LABELS[type]} eyebrow="Ranked on adoption, recent growth and developer activity" />
          <div className="card divide-y divide-black/10">
            {groupRows.map((entity, index) => {
              const score = entity.score!;
              return (
                <article key={entity.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(16rem,0.8fr)] sm:items-center sm:px-5">
                  <span className="font-mono text-xs tabular-nums text-black/45">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={entity.websiteUrl} target="_blank" rel="noreferrer" className="font-bold text-black transition-colors hover:text-accent">{entity.name}</a>
                      <Badge tone="muted">{entity.audiences.join(" · ")}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-black/60">{entity.description}</p>
                    <p className="mt-1 text-xs text-black/45">{entity.useCases.join(" · ")}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-xs sm:text-right">
                    <div><dt className="text-black/45">Adoption</dt><dd className="mt-1 font-mono font-bold tabular-nums text-black">{pct(score.adoption)}</dd></div>
                    <div><dt className="text-black/45">Momentum</dt><dd className="mt-1 font-mono font-bold tabular-nums text-pos">{pct(score.momentum)}</dd></div>
                    <div><dt className="text-black/45">Signals</dt><dd className="mt-1 font-mono font-bold tabular-nums text-black">{score.signalCount}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {rows.length === 0 && <p className="card-dashed p-6 text-sm text-black/60">The daily ecosystem collection has not produced a usable signal yet.</p>}

      <section className="border-t border-black/15 pt-5 text-sm leading-relaxed text-black/60">
        <p>Method: GitHub stars and forks measure public developer adoption; npm weekly downloads measure package usage. Scores are category-neutral discovery signals, not quality or purchase recommendations.</p>
        <p className="mt-2">The machine-readable dataset is available at <Link href="/api/ecosystem.json" className="font-semibold text-accent hover:text-accent-strong">/api/ecosystem.json</Link>.</p>
      </section>
    </div>
  );
}
