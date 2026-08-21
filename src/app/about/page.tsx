import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="prose-invert max-w-3xl space-y-8 text-sm leading-relaxed text-zinc-300">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">About &amp; methodology</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">Data source</h2>
        <p>
          All model specifications, capabilities and prices come from{" "}
          <a href="https://models.dev" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
            models.dev
          </a>
          , an open-source, community-maintained database of AI models. An hourly job fetches
          <code className="mx-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs">api.json</code> and
          <code className="mx-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs">models.json</code>, validates them,
          and diffs the result against the previous snapshot.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">How diffs work</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Every provider-model listing is flattened into comparable fields (costs, limits, capabilities, status).</li>
          <li>Field-level changes become typed events: <b>repriced</b>, <b>deprecated</b>, <b>context_changed</b>, <b>capability_changed</b>.</li>
          <li>A model appearing under a new provider emits <b>provider_added</b>; a brand-new canonical model emits <b>model_added</b>.</li>
          <li>Snapshots are committed to git, so history is auditable and reproducible.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">Pricing caveats</h2>
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
        <h2 className="text-lg font-semibold text-zinc-100">For machines</h2>
        <p>
          Every view has a JSON twin — see{" "}
          <a href="/llms.txt" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
            /llms.txt
          </a>{" "}
          for the index. Agents are first-class consumers here.
        </p>
      </section>
    </div>
  );
}
