import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { RouteIdentityDiagram } from "@/components/field-note-diagrams";

export const metadata: Metadata = {
  title: "The same model is not the same route",
  description: "How direct APIs, gateways, BYOK, cloud deployments and fallbacks change the thing you are buying.",
  alternates: { canonical: "/field-notes/same-model-different-route" },
};

const ROUTES = [
  ["Direct API", "Lab account → lab endpoint", "Lab price, lab quota, lab safety and lab availability", "Model access may be limited by organization or project."],
  ["Gateway", "Your key → router → provider", "Gateway price, gateway policy, selected provider and fallback behavior", "The gateway can pool uptime without guaranteeing upstream capacity."],
  ["BYOK", "Your gateway key + your upstream key", "Two account scopes, two billing systems and possibly a gateway fee", "A gateway may fall back to shared capacity unless routing is pinned."],
  ["Cloud deployment", "Cloud project → regional service → model", "Cloud quota, region, IAM policy and service tier", "Azure, Vertex and Bedrock are not interchangeable direct APIs."],
  ["Self-hosted", "Your client → your deployment", "Your hardware, queue, tokenizer, observability and license", "A healthy process does not imply enough throughput for the workload."],
];

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">{children} ↗</a>;
}

export default function SameModelPage() {
  return (
    <article className="max-w-5xl space-y-10">
      <header className="page-intro page-intro-split"><div className="flex flex-wrap items-center gap-2"><Badge tone="special" mono>Field note 03</Badge><span className="mono-label">Published Aug 31, 2026</span></div><h1 className="text-3xl font-bold tracking-tight text-black sm:text-5xl">The same model is not the same route</h1><p className="max-w-3xl text-base leading-relaxed text-black/70">“Claude,” “GPT,” or “Qwen” names the model family. It does not tell you which account is billed, which endpoint served the request, which policy was applied or how much capacity is behind it.</p></header>

      <RouteIdentityDiagram />

      <section className="max-w-3xl space-y-4"><h2 className="font-hand text-3xl font-bold tracking-tight text-black">Route identity is part of the product</h2><p className="text-base leading-relaxed text-black/70">A model comparison that collapses direct APIs, gateways and cloud deployments into one row can compare the wrong prices and the wrong limits. The model ID is only one coordinate. A useful record also keeps the route, provider, region, service tier, billing owner and whether a fallback was used.</p><p className="text-base leading-relaxed text-black/70">OpenRouter makes this visible through provider routing controls and optional router metadata. OpenCode Zen is itself an AI gateway with its own credits and monthly workspace limits. NVIDIA NIM, by contrast, exposes local readiness and Prometheus metrics for a deployment rather than a shared hosted-account balance. <ExternalLink href="https://openrouter.ai/docs/guides/routing/provider-selection">OpenRouter routing</ExternalLink> · <ExternalLink href="https://dev.opencode.ai/docs/zen/">OpenCode Zen</ExternalLink> · <ExternalLink href="https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html">NVIDIA NIM</ExternalLink></p></section>

      <section className="space-y-4"><h2 className="font-hand text-3xl font-bold tracking-tight text-black">Five routes, five different truths</h2><div className="data-table-shell"><div className="data-table-viewport"><table className="table-base min-w-[62rem]"><thead><tr><th>Route</th><th>Path</th><th>What sets the economics</th><th>Common mistake</th></tr></thead><tbody>{ROUTES.map(([name, path, economics, mistake]) => <tr key={name}><td className="font-semibold text-black">{name}</td><td>{path}</td><td>{economics}</td><td>{mistake}</td></tr>)}</tbody></table></div></div></section>

      <section className="grid gap-4 md:grid-cols-3"><div className="card p-5"><p className="mono-label text-accent">Price</p><h2 className="mt-2 text-xl font-bold text-black">Name the payer</h2><p className="mt-2 text-sm leading-relaxed text-black/65">A gateway quote and a lab quote can share a model name while charging different request, token, cache or tool rates.</p></div><div className="card p-5"><p className="mono-label text-pos">Access</p><h2 className="mt-2 text-xl font-bold text-black">Name the authority</h2><p className="mt-2 text-sm leading-relaxed text-black/65">Keys may be scoped to an organization, project, workspace, cloud account or deployment. “The key works” is not enough.</p></div><div className="card p-5"><p className="mono-label text-warn">Capacity</p><h2 className="mt-2 text-xl font-bold text-black">Name the evidence</h2><p className="mt-2 text-sm leading-relaxed text-black/65">Use provider-reported limits, rolling performance, request telemetry and route metadata. Keep guarantees separate from observations.</p></div></section>

      <section className="card-dashed max-w-3xl space-y-3 p-5"><p className="mono-label text-special">A route record</p><pre className="overflow-x-auto font-mono text-xs leading-6 text-black/70">{`model: anthropic/claude-sonnet
route: gateway
gateway: openrouter
selected_provider: Anthropic
region: global
billing_owner: gateway account
byok: false
fallback_used: false
evidence: response metadata + generation record`}</pre><p className="text-xs leading-relaxed text-black/55">This shape lets a reader explain a price, an error or a latency number after the fact.</p></section>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-5" aria-label="Field notes"><Link href="/field-notes" className="text-sm font-semibold text-accent hover:text-accent-strong">← All field notes</Link><Link href="/field-notes/api-key-introspection" className="text-sm font-semibold text-black/50">Previous note: what an API key can tell you →</Link></nav>
    </article>
  );
}

