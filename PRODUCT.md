# Model Pulse — Product context

## Product

Model Pulse is a static, editorial market desk for AI model infrastructure. It
turns the open models.dev catalog plus committed market snapshots into a daily
front page for people choosing, comparing, and buying model API capacity.

The product promise is: **Every AI model. Every provider. Every change.** The
site reports prices, releases, repricings, benchmark value, context tiers,
open-weight facts, and provider availability with explicit provenance and
workload assumptions.

## Audience

- Engineers and technical buyers comparing API providers and model economics.
- Platform, procurement, and infrastructure teams evaluating whether to buy,
  compare, or price out self-hosting.
- Curious practitioners who need a current, checkable view of the AI model
  market rather than a generic model directory.

Readers are time-constrained and comfortable with technical detail. They skim
the front page first, then drill into model, provider, benchmark, calculator,
exchange, or methodology views.

## Product principles

- Be a market desk, not a dashboard: lead with what changed and why it matters.
- Separate first-party pricing from gateway inventory and markup.
- Treat every number as a function of its workload, unit, provenance, and date.
- Prefer an honest dash or dated pending state to a fabricated conclusion.
- Keep rankings and recommendations explainable in one line.
- Make the data source, method, and limitations visible at the point of use.

## Platform

- Platform: `web`
- Architecture: Next.js static export; pages are prerendered from committed
  snapshot, event, news, and enrichment files.
- Deployment: Vercel project `modelsdevweb`.
- Primary route: `/`; supporting routes cover models, providers, labs,
  benchmarks, compare, calculator, self-host, exchange, trends, changelog,
  news, digest, and status.

## Register

This is a product interface with an editorial publication layer. The visual
register is a daylight market desk: compact, calm, precise, sturdy, and easy
to scan on a work laptop. It should feel like useful infrastructure software,
not a trading-terminal costume or a newspaper pastiche.

## Success signals

- A reader can understand today's market story above the fold.
- A reader can compare a model across venues without confusing a reseller with
  the lab.
- Every material price, benchmark, and longitudinal claim has a visible basis.
- The same semantic meaning and formatting survives across homepage, tables,
  charts, cards, feeds, and API artifacts.
