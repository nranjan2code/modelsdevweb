

/**
 * The return mechanism.
 *
 * A publication whose only subscription channel is RSS is renting its audience
 * from whoever last shared it. The list is the one asset here that compounds
 * like the price archive does — and unlike ad inventory, a sponsored digest can
 * be sold without any ranking on the site knowing it exists.
 *
 * Static export, so the form posts directly to whatever list provider is
 * configured. With no endpoint set it degrades to RSS rather than rendering a
 * field that silently does nothing — an input that eats an address is worse
 * than no input.
 */
const ACTION = process.env.NEXT_PUBLIC_NEWSLETTER_ACTION ?? "";

export function Subscribe({ changeCount, windowLabel }: { changeCount: number; windowLabel: string }) {
  return (
    <section className="card relative overflow-hidden">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
        <div>
          <p className="mono-label text-accent">Weekly edition</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-black">
            One email. The changes that actually cost you money.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">
            {changeCount} catalog changes landed in {windowLabel}. Most are inventory noise. The
            digest separates first-party repricing and retirements from reseller noise, names the
            models whose bill moved, and says plainly when the week was quiet.
          </p>
          <p className="micro-label mt-3">
            Auto-written from the auditable diff log · no manufactured story · unsubscribe in one click
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {ACTION ? (
            <form action={ACTION} method="post" target="_blank" className="space-y-2">
              <label htmlFor="subscribe-email" className="sr-only">
                Email address
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="subscribe-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="input w-full"
                />
                <button type="submit" className="button-primary shrink-0">
                  Subscribe
                </button>
              </div>
              <p className="micro-label">
                Weekly, Mondays. No other mail, ever.
              </p>
            </form>
          ) : (
            <div className="space-y-2">
              <a href="/rss.xml" className="button-primary inline-block">
                Subscribe via RSS
              </a>
              <p className="micro-label">Email edition coming; RSS carries the same digest today.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-black/10 pt-3">
            <a href="/digest" className="text-sm font-semibold text-accent hover:text-accent-strong">
              Read this week&apos;s →
            </a>
            <a href="/rss.xml" className="text-sm font-semibold text-accent hover:text-accent-strong">
              RSS →
            </a>
            <a href="/llms.txt" className="text-sm font-semibold text-accent hover:text-accent-strong">
              For agents →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
