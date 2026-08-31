import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { LimitDiagnosisDiagram } from "@/components/field-note-diagrams";

export const metadata: Metadata = {
  title: "Why a 429 is not one thing",
  description: "A practical way to distinguish request limits, token limits, spend caps, acceleration limits and overloaded providers.",
  alternates: { canonical: "/field-notes/why-429-is-not-one-thing" },
};

const CASES = [
  ["Request limit", "RPM, RPS or daily requests", "Headers identify the bucket; reduce concurrency or wait for reset.", "OpenAI, Anthropic and Groq expose request-limit signals."],
  ["Token limit", "Input, output or aggregate tokens", "A small number of very large prompts can exhaust capacity before request count does.", "OpenAI and Anthropic return token-limit headers; Groq documents TPM/TPD."],
  ["Spend cap", "A monetary ceiling over a window", "More retries will not help; the account or workspace needs a billing change or reset.", "Gemini documents spend-based limits; other providers may return a billing-specific error."],
  ["Acceleration", "A sudden ramp in traffic", "The account is within its headline tier but the traffic shape is too abrupt.", "Anthropic documents acceleration limits separately from ordinary rate limits."],
  ["Provider capacity", "The selected model or route is overloaded", "Try bounded backoff, a different provider, region or service tier.", "A 429/503/529 may carry no personal-quota explanation."],
];

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">{children} ↗</a>;
}

export default function Why429Page() {
  return (
    <article className="max-w-5xl space-y-10">
      <header className="page-intro page-intro-split">
        <div className="flex flex-wrap items-center gap-2"><Badge tone="special" mono>Field note 02</Badge><span className="mono-label">Published Aug 31, 2026</span></div>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-5xl">Why a 429 is not one thing</h1>
        <p className="max-w-3xl text-base leading-relaxed text-black/70">A rate-limit response is a symptom. The useful diagnosis comes from the limit dimension, the reset evidence and the shape of the request that triggered it.</p>
      </header>

      <LimitDiagnosisDiagram />

      <section className="max-w-3xl space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">Start with the body, then the headers</h2>
        <p className="text-base leading-relaxed text-black/70">A good adapter preserves the provider&apos;s original status, error type, message, structured details and retry hint before translating it into a common status. Otherwise “rate limited” becomes a bucket that hides the next action.</p>
        <p className="text-base leading-relaxed text-black/70">For example, Gemini&apos;s <code className="rounded-md border border-black/15 bg-black/5 px-1.5 py-0.5 font-mono text-sm">RESOURCE_EXHAUSTED</code> can be associated with requests, tokens, daily limits or spend-based limits. Google recommends exponential backoff for retryable 429 and 503 responses, while its quota documentation says limits are project-level and model-specific. <ExternalLink href="https://ai.google.dev/gemini-api/docs/rate-limits">Read Gemini&apos;s limits</ExternalLink> · <ExternalLink href="https://ai.google.dev/gemini-api/docs/troubleshooting">Read Gemini&apos;s retry guidance</ExternalLink></p>
      </section>

      <section className="space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">The five diagnoses</h2>
        <div className="data-table-shell"><div className="data-table-viewport"><table className="table-base min-w-[62rem]"><thead><tr><th>Diagnosis</th><th>Limit dimension</th><th>Operational response</th><th>Evidence to retain</th></tr></thead><tbody>{CASES.map(([name, dimension, response, evidence]) => <tr key={name}><td className="font-semibold text-black">{name}</td><td>{dimension}</td><td>{response}</td><td>{evidence}</td></tr>)}</tbody></table></div></div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5"><p className="mono-label text-pos">Retry</p><h2 className="mt-2 text-xl font-bold text-black">When retrying makes sense</h2><p className="mt-2 text-sm leading-relaxed text-black/65">Use the provider&apos;s <code className="font-mono">retry-after</code> when present. Otherwise use capped exponential backoff with jitter, and only retry idempotent work. Track the attempt count and final reason.</p></div>
        <div className="card p-5"><p className="mono-label text-neg">Stop</p><h2 className="mt-2 text-xl font-bold text-black">When retrying is noise</h2><p className="mt-2 text-sm leading-relaxed text-black/65">Do not loop on invalid keys, missing model access, a hard spend cap or a request that exceeds context. A 429 that repeats instantly across providers may be your traffic shape, not the market.</p></div>
      </section>

      <section className="card-dashed max-w-3xl space-y-3 p-5"><p className="mono-label text-warn">What to store</p><p className="text-sm leading-relaxed text-black/70">Provider, endpoint, model, project/workspace scope, HTTP status, error type, selected rate-limit headers, retry-after, request size, token usage, latency, generation/request ID and whether the request was retried. This is enough to explain most incidents without logging prompts.</p><p className="text-xs leading-relaxed text-black/55">Primary references: <ExternalLink href="https://platform.openai.com/docs/api-reference/authentication">OpenAI</ExternalLink> · <ExternalLink href="https://platform.claude.com/docs/en/api/rate-limits">Anthropic</ExternalLink> · <ExternalLink href="https://console.groq.com/docs/rate-limits">Groq</ExternalLink> · <ExternalLink href="https://docs.mistral.ai/resources/known-limitations">Mistral</ExternalLink>.</p></section>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-5" aria-label="Field notes"><Link href="/field-notes" className="text-sm font-semibold text-accent hover:text-accent-strong">← All field notes</Link><Link href="/field-notes/same-model-different-route" className="text-sm font-semibold text-black/50">Next note: the same model is not the same route →</Link></nav>
    </article>
  );
}

