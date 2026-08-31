export function LimitDiagnosisDiagram() {
  return (
    <figure className="card-flat overflow-hidden p-4 sm:p-6" aria-labelledby="limit-diagnosis-caption">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-black/15 bg-surface p-4">
          <p className="mono-label text-accent">The response</p>
          <p className="mt-2 font-mono text-sm text-black">429</p>
          <p className="mt-2 text-xs leading-relaxed text-black/60">A shared status code. It says the request was refused, not why.</p>
        </div>
        <div className="flex items-center justify-center text-2xl text-black/35 md:rotate-0">→</div>
        <div className="rounded-md border border-black/15 bg-surface p-4">
          <p className="mono-label text-special">The evidence</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-black/65">
            <li>Headers: remaining and reset</li>
            <li>Body: structured error details</li>
            <li>Request: model, tokens, service tier</li>
          </ul>
        </div>
      </div>
      <div className="mt-3 grid gap-3 border-t border-black/10 pt-3 sm:grid-cols-3">
        <div className="rounded-md bg-pos-soft p-3"><p className="mono-label text-pos">Quota</p><p className="mt-1 text-xs text-black/65">Wait for reset or reduce the request.</p></div>
        <div className="rounded-md bg-warn-soft p-3"><p className="mono-label text-warn">Acceleration</p><p className="mt-1 text-xs text-black/65">Slow the ramp; the account may be bursting.</p></div>
        <div className="rounded-md bg-neg-soft p-3"><p className="mono-label text-neg">Capacity</p><p className="mt-1 text-xs text-black/65">Retry with bounded backoff or another route.</p></div>
      </div>
      <figcaption id="limit-diagnosis-caption" className="micro-label mt-4">One status code; three different operational diagnoses.</figcaption>
    </figure>
  );
}

export function RouteIdentityDiagram() {
  return (
    <figure className="card-flat overflow-hidden p-4 sm:p-6" aria-labelledby="route-identity-caption">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
        <div className="rounded-md border-2 border-black bg-ink p-4 text-white">
          <p className="mono-label text-white/65">Your request</p>
          <p className="mt-2 font-mono text-sm">model + key + policy</p>
        </div>
        <div className="flex items-center justify-center text-2xl text-black/35">→</div>
        <div className="rounded-md border border-accent/30 bg-accent-soft p-4">
          <p className="mono-label text-accent">The route</p>
          <p className="mt-2 font-mono text-sm text-black">gateway → provider</p>
          <p className="mt-2 text-xs leading-relaxed text-black/60">Fallbacks, region, data policy and BYOK can change the endpoint.</p>
        </div>
        <div className="flex items-center justify-center text-2xl text-black/35">→</div>
        <div className="rounded-md border border-special/30 bg-special-soft p-4">
          <p className="mono-label text-special">The result</p>
          <p className="mt-2 font-mono text-sm text-black">price + latency + policy</p>
          <p className="mt-2 text-xs leading-relaxed text-black/60">The model name alone cannot tell you all three.</p>
        </div>
      </div>
      <figcaption id="route-identity-caption" className="micro-label mt-4">The purchased object is a model on a route, not a model name in isolation.</figcaption>
    </figure>
  );
}

