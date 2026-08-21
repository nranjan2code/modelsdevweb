import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="max-w-3xl space-y-10 text-sm leading-relaxed text-black/70">
      <header className="space-y-2">
        <p className="mono-label">Methodology</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">About &amp; methodology</h1>
      </header>

      <section className="space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">Data source</h2>
        <p>
          All model specifications, capabilities and prices come from{" "}
          <a
            href="https://models.dev"
            className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
          >
            models.dev
          </a>
          , an open-source, community-maintained database of AI models. An hourly job fetches
          <code className="mx-1 rounded-md border border-black/15 bg-black/[0.04] px-1.5 py-0.5 font-mono text-xs">api.json</code>
          and
          <code className="mx-1 rounded-md border border-black/15 bg-black/[0.04] px-1.5 py-0.5 font-mono text-xs">models.json</code>,
          validates them, and diffs the result against the previous snapshot.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">How diffs work</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Every provider-model listing is flattened into comparable fields (costs, limits, capabilities, status).</li>
          <li>Field-level changes become typed events: <b className="text-black">repriced</b>, <b className="text-black">deprecated</b>, <b className="text-black">context_changed</b>, <b className="text-black">capability_changed</b>.</li>
          <li>A model appearing under a new provider emits <b className="text-black">provider_added</b>; a brand-new canonical model emits <b className="text-black">model_added</b>.</li>
          <li>Snapshots are committed to git, so history is auditable and reproducible.</li>
        </ul>
      </section>

      <section className="space-y-2">
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

      <section className="space-y-2">
        <h2 className="font-hand text-2xl font-bold tracking-tight text-black">For machines</h2>
        <p>
          Every view has a JSON twin — see{" "}
          <a
            href="/llms.txt"
            className="font-medium text-blue-600 underline decoration-wavy underline-offset-4 hover:text-blue-700"
          >
            /llms.txt
          </a>{" "}
          for the index. Agents are first-class consumers here.
        </p>
      </section>
    </div>
  );
}
