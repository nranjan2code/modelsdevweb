import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog } from "@/lib/data";
import { getWeights } from "@/lib/data/weights";
import {
  apiOnlyCases,
  countFreelyUsable,
  GPU_PRICES_AS_OF,
  GPU_TIERS,
  hostableCases,
  hostingCase,
  memoryRequiredGb,
} from "@/lib/data/selfhost";
import { labName } from "@/lib/data/brief";
import { SelfHostTable, type HostRow } from "@/components/self-host-table";
import { Badge, SectionHead } from "@/components/ui";

export const metadata: Metadata = {
  title: "Self-host or buy?",
  description:
    "For every open-weight model, the monthly GPU rent versus the API bill at your volume — and whether the licence even permits self-hosting.",
  alternates: { canonical: "/self-host" },
};

export default async function SelfHostPage() {
  const [catalog, weights] = await Promise.all([getCatalog(), getWeights()]);

  const cases = hostableCases(catalog.tracked, weights.models, 500);
  const rows: HostRow[] = cases.map((c) => ({
    id: c.groupId,
    name: c.name,
    labName: labName(catalog.groupById.get(c.groupId)?.labId ?? ""),
    parameters: c.parameters!,
    gpus: c.floor!.gpus,
    gpuName: c.floor!.tier.name,
    rentPerMonth: c.floor!.usdPerMonth,
    apiPerM: c.apiBlendedPerM!,
    licence: c.licence,
  }));

  const apiOnly = apiOnlyCases(catalog.tracked, weights.models, 20);
  const freelyUsable = countFreelyUsable(catalog.tracked, weights.models);
  const tooBig = catalog.tracked
    .map((g) => hostingCase(g, weights.models[g.id]))
    .filter((c) => c.verdict === "needs-cluster")
    .sort((a, b) => (b.parameters ?? 0) - (a.parameters ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-12">
      <header className="page-intro">
        <p className="mono-label text-special">The other half of the price question</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Self-host or buy?</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          {freelyUsable} of the models tracked here are permissively licensed and download without
          asking, so paying per token is a choice. A rented GPU costs the same whether you serve one
          token or a billion, and the API has no fixed cost — so the question is simply whether your
          bill clears the rent. Set your volume and see.
        </p>
      </header>

      <SelfHostTable rows={rows} />

      {apiOnly.length > 0 && (
        <section>
          <SectionHead title="Not your decision to make" eyebrow="Licence says API only" eyebrowTone="neg" />
          <p className="-mt-2 mb-4 max-w-2xl text-sm leading-relaxed text-black/60">
            These publish their weights, but under a licence that forbids commercial use. However
            large you get, buying the API is the only route for a product.
          </p>
          <div className="card p-5">
            <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {apiOnly.map((c) => (
                <li key={c.groupId} className="flex items-center justify-between gap-3">
                  <Link href={`/m/${c.groupId}`} className="truncate font-medium transition-colors hover:text-accent">
                    {c.name}
                  </Link>
                  <Badge tone="neg" mono>{c.licence ?? "non-commercial"}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tooBig.length > 0 && (
        <section>
          <SectionHead title="Bigger than one box" eyebrow="Beyond a single node" eyebrowTone="warn" />
          <p className="-mt-2 mb-4 max-w-2xl text-sm leading-relaxed text-black/60">
            At bf16 these need more memory than eight GPUs hold, so a meaningful rent figure would
            mean pricing a cluster and the networking around it. Quantising to 8- or 4-bit roughly
            halves or quarters the requirement and can bring some of them back into range — at some
            cost to quality.
          </p>
          <div className="card p-5">
            <ul className="divide-y divide-black/10 text-sm">
              {tooBig.map((c) => (
                <li key={c.groupId} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/m/${c.groupId}`} className="truncate font-medium transition-colors hover:text-accent">
                    {c.name}
                  </Link>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-black/60">
                    {Math.round((c.parameters ?? 0) / 1e9)}B · ~
                    {Math.round(memoryRequiredGb(c.parameters ?? 0))} GB
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section>
        <SectionHead title="How this is worked out" eyebrow="Method" />
        <div className="card-flat space-y-4 p-5 text-sm leading-relaxed text-black/70">
          <p>
            <strong className="font-semibold text-black">Throughput is deliberately not modelled.</strong>{" "}
            Tokens per second depends on hardware, batch size, quantisation, framework and sequence
            length. Any single figure would be invented precision, so instead of guessing we compare
            the one cost that is certain: the rent.
          </p>
          <p>
            <strong className="font-semibold text-black">Memory</strong> is parameters × 2 bytes
            (bf16) plus 25% for KV cache, activations and framework overhead. Long contexts and large
            batches need more. We then pick the cheapest configuration of up to eight GPUs whose
            combined VRAM holds that.
          </p>
          <p>
            <strong className="font-semibold text-black">GPU rates</strong> are representative
            on-demand list prices as of {GPU_PRICES_AS_OF} — {GPU_TIERS.map((t) => `${t.name} $${t.usdPerHour}/hr`).join(", ")}
            {" "}— billed at 730 hours a month. Reserved and spot capacity run materially cheaper.
          </p>
          <p>
            <strong className="font-semibold text-black">The comparison flatters self-hosting.</strong>{" "}
            It assumes a permanently saturated GPU and counts no engineering time, no redundancy, no
            idle capacity and no traffic peaks. Real deployments are worse on every one of those. So
            treat a positive difference as permission to price it out properly — not as a saving.
          </p>
          <p className="micro-label tracking-wider">
            licence and parameter counts from huggingface.co model cards · API prices are the cheapest
            listed blended rate across every provider we track
          </p>
        </div>
      </section>
    </div>
  );
}
