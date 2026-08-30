import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "What an API key can actually tell you",
  description: "How programs discover API key identity, usage, balances, quotas, free tiers and capacity across AI providers.",
  alternates: { canonical: "/field-notes/api-key-introspection" },
};

const PROVIDERS = [
  {
    name: "OpenRouter",
    headers: "X-Generation-Id; optional cache and router metadata",
    account: "GET /api/v1/key; /api/v1/credits; management analytics",
    key: "Free-tier flag, key usage, configured limit, remaining limit, expiry and BYOK usage",
    unknown: "Live provider capacity",
  },
  {
    name: "OpenAI",
    headers: "x-request-id; x-ratelimit-*; openai-organization; openai-processing-ms",
    account: "Organization Usage and Costs APIs",
    key: "Accessible models and per-response request/token limits",
    unknown: "Billing history from an ordinary inference key",
  },
  {
    name: "Anthropic",
    headers: "anthropic-ratelimit-*; retry-after; workspace ID where available",
    account: "Rate Limits API and Admin usage reports",
    key: "Request, total-token and input-token limits and remaining amounts",
    unknown: "Guaranteed minimum serving capacity",
  },
  {
    name: "Google Gemini",
    headers: "No universal remaining-quota header is documented",
    account: "Google AI Studio and Cloud quota/billing surfaces",
    key: "Project-scoped model access and response usage metadata",
    unknown: "Exact quota and live capacity from the key alone",
  },
  {
    name: "Groq",
    headers: "x-ratelimit-*; retry-after; 498 for Flex capacity exhaustion",
    account: "Console Limits, Projects, Billing and metrics",
    key: "Remaining request and token limits in inference responses",
    unknown: "Organization billing without account permissions",
  },
  {
    name: "Mistral",
    headers: "X-RateLimit-Remaining; 429 on request/token limit exhaustion",
    account: "Admin rate-limit and spend-limit APIs",
    key: "Observed remaining limit and response usage where returned",
    unknown: "Full organization limits from a normal key",
  },
  {
    name: "Fireworks",
    headers: "X-Ratelimit-Limit-Tokens-Prompt; fireworks-* token headers",
    account: "Account and project console",
    key: "Prompt and cached-prompt token counts plus prompt-token limit",
    unknown: "A complete monetary balance in the inference response",
  },
  {
    name: "Together AI",
    headers: "No universal remaining-limit header prominently documented",
    account: "Project and organization usage/cost analytics",
    key: "Project scope, accessible models and response usage",
    unknown: "Per-key spend or rate cap; limits are organization-level",
  },
];

const TONE_CLASSES = {
  accent: "text-accent",
  pos: "text-pos",
  special: "text-special",
  warn: "text-warn",
} as const;

function LinkOut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
      {children} ↗
    </a>
  );
}

export default function ApiKeyIntrospectionPage() {
  return (
    <article className="max-w-5xl space-y-10">
      <header className="page-intro page-intro-split">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="special" mono>Field note 01</Badge>
          <span className="mono-label">Published Aug 31, 2026</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-5xl">What an API key can actually tell you</h1>
        <p className="max-w-3xl text-base leading-relaxed text-black/70">
          A key is not a tiny account database. It is an opaque credential that lets a provider look up an
          account, apply policy, and return a small, provider-specific slice of that account&apos;s state.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Identity", "Does the credential authenticate, and what can it access?", "accent"],
          ["Entitlement", "Which models, tiers and free allowances apply?", "pos"],
          ["Meter", "What has been used, and what limit remains?", "special"],
          ["Capacity", "Can the service accept work right now?", "warn"],
        ].map(([title, copy, tone]) => (
          <div key={title} className="card-flat p-4">
            <p className={`mono-label ${TONE_CLASSES[tone as keyof typeof TONE_CLASSES]}`}>{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-black/65">{copy}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">The request-to-status flow</h2>
        <div className="card-flat overflow-x-auto p-4 sm:p-6">
          <pre className="min-w-[42rem] font-mono text-xs leading-7 text-black/75">{`user gives key
      ↓
provider adapter selects the right base URL and auth format
      ↓
safe metadata request: /key, /models, or a provider health endpoint
      ↓
HTTP status + response headers + JSON body
      ↓
normalize into: valid · tier · models · usage · limits · reset · unknowns
      ↓
display provider-reported facts separately from observed capacity`}</pre>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-black/60">
          The adapter is the important part. There is no universal API for “balance” or “remaining capacity”;
          each provider chooses its own endpoint, header names, scopes and refresh behavior.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-hand text-3xl font-bold tracking-tight text-black">What the major providers expose</h2>
        <div className="data-table-shell">
          <div className="data-table-viewport">
            <table className="table-base min-w-[64rem]">
              <thead>
                <tr><th>Provider</th><th>Useful response headers</th><th>Account APIs / surfaces</th><th>Key can reveal</th><th>Still unknown</th></tr>
              </thead>
              <tbody>
                {PROVIDERS.map((provider) => (
                  <tr key={provider.name}>
                    <td className="font-semibold text-black">{provider.name}</td>
                    <td>{provider.headers}</td>
                    <td>{provider.account}</td>
                    <td>{provider.key}</td>
                    <td>{provider.unknown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5"><p className="mono-label text-pos">Provider-reported</p><h2 className="mt-2 text-xl font-bold text-black">Limits and balances</h2><p className="mt-2 text-sm leading-relaxed text-black/65">Use an endpoint or header when the provider supplies one. Attach a timestamp and scope: key, project, workspace or organization.</p></div>
        <div className="card p-5"><p className="mono-label text-accent">Observed</p><h2 className="mt-2 text-xl font-bold text-black">A successful request</h2><p className="mt-2 text-sm leading-relaxed text-black/65">Record model, provider, latency, status, usage and generation ID. This describes what just happened, not a reservation.</p></div>
        <div className="card p-5"><p className="mono-label text-warn">Unknown</p><h2 className="mt-2 text-xl font-bold text-black">Live capacity</h2><p className="mt-2 text-sm leading-relaxed text-black/65">A 200 proves one request worked. It does not reveal how much shared GPU capacity remains five seconds later.</p></div>
      </section>

      <section className="card-dashed max-w-3xl space-y-3 p-5">
        <p className="mono-label text-special">Implementation rule</p>
        <p className="text-sm leading-relaxed text-black/70">
          Never label a model “free” only because its catalog price is zero. Check account entitlement, quota,
          reset policy and billing scope. Never label a provider “available” only because its model list contains
          the model.
        </p>
        <p className="text-xs leading-relaxed text-black/55">
          Primary references: <LinkOut href="https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key">OpenRouter</LinkOut>, <LinkOut href="https://platform.openai.com/docs/api-reference/authentication">OpenAI</LinkOut>, <LinkOut href="https://platform.claude.com/docs/en/api/rate-limits">Anthropic</LinkOut>, <LinkOut href="https://ai.google.dev/gemini-api/docs/rate-limits">Gemini</LinkOut>, <LinkOut href="https://console.groq.com/docs/rate-limits">Groq</LinkOut>, <LinkOut href="https://docs.mistral.ai/resources/known-limitations">Mistral</LinkOut>.
        </p>
      </section>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-5" aria-label="Field notes">
        <Link href="/field-notes" className="text-sm font-semibold text-accent hover:text-accent-strong">← All field notes</Link>
        <span className="mono-label text-black/45">Next note: why a 429 is not one thing</span>
      </nav>
    </article>
  );
}
