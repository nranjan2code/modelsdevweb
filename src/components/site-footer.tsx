import Link from "next/link";
import { getCatalog } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";
import { BrandMark } from "@/components/brand-mark";

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/browse", label: "Browse catalog" },
      { href: "/compare", label: "Compare models" },
      { href: "/calculator", label: "Cost calculator" },
    ],
  },
  {
    title: "Market",
    links: [
      { href: "/exchange#equity-context", label: "Public-market context" },
      { href: "/exchange", label: "Token exchange" },
      { href: "/benchmarks", label: "Benchmarks" },
      { href: "/trends", label: "Trends" },
      { href: "/providers", label: "Providers" },
    ],
  },
  {
    title: "Track",
    links: [
      { href: "/digest", label: "Weekly digest" },
      { href: "/changelog", label: "Changelog" },
      { href: "/deprecations", label: "Deprecations" },
    ],
  },
  {
    title: "Data",
    links: [
      { href: "/rss.xml", label: "RSS feed", external: true },
      { href: "/api/models.json", label: "Models JSON", external: true },
      { href: "/api/events.json", label: "Events JSON", external: true },
      { href: "/llms.txt", label: "llms.txt for agents", external: true },
      { href: "/status", label: "Pipeline status" },
    ],
  },
];

export async function SiteFooter() {
  const { stats } = await getCatalog();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t-4 border-accent bg-ink text-white">
      <div className="mx-auto flex max-w-[90rem] flex-col items-start justify-between gap-10 px-4 py-12 sm:px-6 md:flex-row md:items-start">
        <h2 className="sr-only">Site links</h2>
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <BrandMark boxClassName="h-8 w-8" />
            <span className="text-xl font-bold text-white">{SITE_NAME}</span>
          </div>
          <p className="mt-3 text-sm font-medium text-white/75">
            Every AI model. Every provider. Every change.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/65">
            Built on open data from{" "}
            <a
              href="https://models.dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-7 items-center underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
            >
              models.dev
            </a>
            . Prices are per 1M tokens (USD); a dash means unlisted, not free — verify with the
            provider before purchasing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-8 text-sm sm:grid-cols-4 md:gap-x-10 lg:gap-x-14">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-hand mb-4 text-lg font-bold text-white">{col.title}</h3>
              <ul className="space-y-2 font-medium text-white/65">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} className="inline-flex min-h-7 items-center transition-colors hover:text-white">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="inline-flex min-h-7 items-center transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
          <p className="text-center font-mono text-xs text-white/60">
            © {year} {SITE_NAME} · data updated{" "}
            <time dateTime={stats.snapshotDate ?? undefined}>{fmtDate(stats.snapshotDate)}</time> ·{" "}
            <a
              href="https://www.vakyartha.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-7 items-center underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
            >
              A Vakyartha project
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
