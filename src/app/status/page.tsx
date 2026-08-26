import type { Metadata } from "next";
import { Badge, SectionHead } from "@/components/ui";
import { getPipelineStatus } from "@/lib/data";

export const metadata: Metadata = {
  title: "Pipeline status",
  description: "The latest Model Pulse data run, source freshness and update cadence.",
  alternates: { canonical: "/status" },
};

function dateTime(iso: string | null): string {
  if (!iso) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function ageLabel(iso: string | null, runAt: string | null): string {
  if (!iso || !runAt) return "No recorded run";
  const hours = Math.max(0, Math.round((new Date(runAt).getTime() - new Date(iso).getTime()) / 3_600_000));
  if (hours === 0) return "Same run";
  return `${hours}h before the model snapshot`;
}

export default async function StatusPage() {
  const status = await getPipelineStatus();

  return (
    <div className="space-y-8">
      <header className="page-intro page-intro-split">
        <p className="mono-label text-pos">Data desk</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Pipeline status</h1>
        <div className="space-y-3 text-sm leading-relaxed text-black/60">
          <p>
            Model Pulse is a static publication with a live data desk behind it. This page records what was
            last refreshed, how often each source is checked, and whether the latest committed run cleared its
            quality gates.
          </p>
          <p className="font-mono text-xs text-black/50">
            Last successful run · {dateTime(status.runAt)}
          </p>
        </div>
      </header>

      <section className="grid gap-px overflow-hidden border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4" aria-label="Latest data run">
        {[
          ["Providers", status.providers.toLocaleString()],
          ["Listings", status.listings.toLocaleString()],
          ["Tracked models", status.models.toLocaleString()],
          ["Archive depth", `${status.archiveDays} days`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface p-5">
            <p className="mono-label">{label}</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-black">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <SectionHead title="What ran" eyebrow="The latest committed run" eyebrowTone="accent" />
        <div className="card-flat overflow-hidden">
          <div className="divide-y divide-black/10">
            {status.items.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_12rem] sm:items-center sm:px-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-black">{item.label}</h3>
                    <Badge tone={item.state === "current" ? "pos" : "muted"}>{item.state === "current" ? "Current" : "Not recorded"}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-black/60">{item.description}</p>
                </div>
                <p className="font-mono text-xs text-black/55">{item.cadence}</p>
                <div className="text-sm sm:text-right">
                  <time className="font-mono text-xs tabular-nums text-black/70" dateTime={item.fetchedAt ?? undefined}>
                    {dateTime(item.fetchedAt)}
                  </time>
                  <p className="mt-1 text-xs text-black/45">{ageLabel(item.fetchedAt, status.runAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <SectionHead title="The runbook" eyebrow="How the desk stays current" eyebrowTone="special" />
          <div className="space-y-3 text-sm leading-relaxed text-black/65">
            <p>Every hour, the job fetches the model catalog, diffs it against the previous snapshot, archives the day, and checks the result against the site’s identity and pricing rules.</p>
            <p>News and licence facts keep their own slower clocks. A run can report that one of these sources was not due for refresh yet; that is expected and does not mean the pipeline failed.</p>
            <p>Only data that clears the gates is committed. Git is the audit trail, and the page you are reading is built from that committed state.</p>
          </div>
        </div>
        <div className="card-flat bg-surface-tint p-5 sm:p-6">
          <p className="mono-label">Committed alongside the snapshot</p>
          <dl className="mt-4 divide-y divide-black/10 text-sm">
            <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-black/60">Catalog groups</dt><dd className="font-mono font-semibold tabular-nums text-black">{status.groups.toLocaleString()}</dd></div>
            <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-black/60">Changelog events</dt><dd className="font-mono font-semibold tabular-nums text-black">{status.events.toLocaleString()}</dd></div>
            <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-black/60">News items</dt><dd className="font-mono font-semibold tabular-nums text-black">{status.newsItems.toLocaleString()}</dd></div>
            <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-black/60">External signals</dt><dd className="font-mono font-semibold tabular-nums text-black">{status.externalSignals.toLocaleString()}</dd></div>
            <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-black/60">Weight records</dt><dd className="font-mono font-semibold tabular-nums text-black">{status.weightedModels.toLocaleString()}</dd></div>
          </dl>
        </div>
      </section>

      <p className="border-t border-black/10 pt-5 text-xs leading-relaxed text-black/50">
        Times shown in India Standard Time. Source timestamps are preserved in the page markup for machines and
        readers who need to verify exactly when a refresh happened.
      </p>
    </div>
  );
}
