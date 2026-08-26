import type { Metadata } from "next";
import Link from "next/link";
import { CopyField } from "@/components/copy-field";
import { JsonLd } from "@/components/jsonld";
import { SITE_URL } from "@/lib/site";

const BADGE_MODEL = {
  id: "openai/gpt-4o",
  name: "GPT-4o",
};

export const metadata: Metadata = {
  title: "About",
  description: "How Model Pulse diffs models.dev hourly into a typed event stream; data sources, licenses and methodology.",
  alternates: { canonical: "/about" },
};

const FAQ = [
  {
    q: "Where does the data come from?",
    a: "All model specifications, prices and capabilities come from models.dev, an open-source, community-maintained database. An hourly job fetches and validates their API, then diffs it against the previous snapshot.",
  },
  {
    q: "How often do prices update?",
    a: "Every hour. When a provider changes a listed price, a repriced event appears in the changelog within the hour, and per-model price history is kept as daily snapshots.",
  },
  {
    q: "What does a dash (—) mean in a price column?",
    a: "It means the provider does not publicly list a price for that model — it is not necessarily free. Always verify with the provider before purchasing.",
  },
  {
    q: "Can I use this data programmatically?",
    a: "Yes — every view has a JSON twin (/api/models.json, /api/prices.json, /api/events.json, /api/benchmarks.json), plus RSS feeds, an llms.txt index and an MCP server. See /llms.txt.",
  },
  {
    q: "Are you affiliated with the labs or benchmarks?",
    a: "No. Benchmark names are trademarks of their maintainers and scores are facts as publicly reported by labs; every leaderboard links back to the official benchmark site and the original score reports.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-10 text-sm leading-relaxed text-black/70">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <header className="page-intro page-intro-split">
        <p className="mono-label">Methodology</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">About &amp; methodology</h1>
        <div className="max-w-2xl">
          <p className="text-2xl font-bold leading-snug tracking-tight text-black sm:text-3xl">
            Every AI model. Every provider. <span className="wavy wavy-accent">Every change.</span>
          </p>
          <p className="mt-3 text-base font-medium leading-relaxed text-black/60">
            Model Pulse is the front page of the AI model market: prices, releases and repricings tracked
            hourly — with the numbers to prove who is cheapest, newest and fastest-moving. Built on open data,
            auditable in git, and free for humans and agents alike.
          </p>
        </div>
      </header>

      <section className="max-w-3xl space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Data source</h2>
        <p>
          All model specifications, capabilities and prices come from{" "}
          <a
            href="https://models.dev"
            className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
          >
            models.dev
          </a>
          , an open-source, community-maintained database of AI models. An hourly job fetches
          <code className="mx-1 rounded-md border border-black/15 bg-black/5 px-1.5 py-0.5 font-mono text-xs">api.json</code>
          and
          <code className="mx-1 rounded-md border border-black/15 bg-black/5 px-1.5 py-0.5 font-mono text-xs">models.json</code>,
          validates them, and diffs the result against the previous snapshot.
        </p>
      </section>

      <section className="max-w-3xl space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">How diffs work</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Every provider-model listing is flattened into comparable fields (costs, limits, capabilities, status).</li>
          <li>Field-level changes become typed events: <b className="text-black">repriced</b>, <b className="text-black">deprecated</b>, <b className="text-black">context_changed</b>, <b className="text-black">capability_changed</b>.</li>
          <li>A model appearing under a new provider emits <b className="text-black">provider_added</b>; a brand-new canonical model emits <b className="text-black">model_added</b>.</li>
          <li>Snapshots are committed to git, so history is auditable and reproducible.</li>
        </ul>
      </section>

      <section className="max-w-3xl space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Pricing caveats</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Prices are USD per 1M tokens as published by models.dev contributors.</li>
          <li>
            A dash (<span className="font-mono">—</span>) means no public price is listed — it is not
            necessarily free. Some providers genuinely list $0; we show those as $0 only when at least one
            side is non-zero or the provider documents a free tier.
          </li>
          <li>Tiered pricing (e.g., above/below 200K context) is flagged but shown at base rates.</li>
          <li>Always verify with the provider before purchasing.</li>
        </ul>
      </section>

      <section className="max-w-3xl space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">For machines</h2>
        <p>
          Every view has a JSON twin — see{" "}
          <a
            href="/llms.txt"
            className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
          >
            /llms.txt
          </a>{" "}
          for the index. Agents are first-class consumers here.
        </p>
      </section>

      <section className="max-w-3xl space-y-3">
        <div className="space-y-2">
          <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Price badges</h2>
          <p>
            Put a model&apos;s current cheapest listed price in a README or documentation page. Each SVG is
            rebuilt from the same catalog as the site; the linked Markdown below sends readers to the full
            provider comparison.
          </p>
        </div>
        <div className="card-flat space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* SVG badges carry their own intrinsic width and are served unmodified for embedding. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/badge/${BADGE_MODEL.id}.svg`}
              alt={`Current price badge for ${BADGE_MODEL.name}`}
              className="h-5 w-auto max-w-full"
            />
            <Link
              href={`/m/${BADGE_MODEL.id}`}
              className="text-xs font-semibold text-accent transition-colors hover:text-accent-strong"
            >
              View {BADGE_MODEL.name} prices →
            </Link>
          </div>
          <CopyField
            label="markdown"
            value={`[![${BADGE_MODEL.name} price](${SITE_URL}/badge/${BADGE_MODEL.id}.svg)](${SITE_URL}/m/${BADGE_MODEL.id})`}
          />
          <p className="text-xs leading-relaxed text-black/60">
            Use the model&apos;s stable path-style ID after <span className="font-mono">/badge/</span>. The
            image updates when the catalog rebuilds; the destination remains the model&apos;s comparison page.
          </p>
        </div>
      </section>

      <section className="max-w-3xl space-y-3">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">FAQ</h2>
        <div className="divide-y divide-black/10 rounded-lg border-2 border-black bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="cursor-pointer list-none font-medium text-black marker:hidden transition-colors hover:text-accent">
                {f.q}
              </summary>
              <p className="mt-2 text-black/60">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-3xl space-y-3">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Sources &amp; licenses</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <b className="text-black">Model data</b> — specifications, prices and capabilities come from{" "}
            <a
              href="https://models.dev"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
            >
              models.dev
            </a>{" "}
            (
            <a
              href="https://github.com/anomalyco/models.dev"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
            >
              MIT-licensed open source
            </a>
            ), a community-maintained database. Prices are published claims by providers, not our measurements.
          </li>
          <li>
            <b className="text-black">Benchmark scores</b> — scores are factual results as publicly reported by
            labs; each model page and leaderboard links to the original report, and well-known benchmarks link
            to their official sites (e.g.{" "}
            <a href="https://www.swebench.com" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-strong">
              SWE-Bench
            </a>
            ,{" "}
            <a href="https://github.com/laude-institute/terminal-bench" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-strong">
              Terminal-Bench
            </a>
            ,{" "}
            <a href="https://arcprize.org" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-strong">
              ARC Prize
            </a>
            ,{" "}
            <a href="https://artificialanalysis.ai" target="_blank" rel="noreferrer" className="font-medium text-accent hover:text-accent-strong">
              Artificial Analysis
            </a>
            ). Benchmark names are trademarks of their respective maintainers; Model Pulse is not affiliated
            with or endorsed by them.
          </li>
          <li>
            <b className="text-black">News headlines</b> — titles, short excerpts and links fetched via the
            Tavily search API; copyright remains with the original publishers, and every item links back to
            its source.
          </li>
          <li>
            <b className="text-black">Fonts</b> — Inter, JetBrains Mono and Caveat, used under the SIL Open
            Font License via Google Fonts.
          </li>
          <li>
            <b className="text-black">This site</b> — code is{" "}
            <a
              href="https://github.com/nranjan2code/modelsdevweb/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
            >
              MIT licensed
            </a>
            . Reuse the data or badges freely with attribution to Model Pulse and models.dev.
          </li>
        </ul>
        <p className="pl-5 text-xs leading-relaxed text-black/60">
          All published content here derives from public sources; nothing confidential is republished.
          Provider names and model brands remain the property of their owners.
        </p>
      </section>
    </div>
  );
}
