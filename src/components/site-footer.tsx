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
      { href: "/benchmarks", label: "Benchmarks" },
      { href: "/trends", label: "Trends" },
      { href: "/providers", label: "Providers" },
    ],
  },
  {
    title: "Track",
    links: [
      { href: "/changelog", label: "Changelog" },
      { href: "/news", label: "Model news" },
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
    ],
  },
];

export async function SiteFooter() {
  const { stats } = await getCatalog();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-black/5 bg-[#FDFBF7]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 px-4 py-12 sm:px-6 md:flex-row md:items-start">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <BrandMark boxClassName="h-8 w-8" />
            <span className="text-xl font-bold tracking-tight text-black">{SITE_NAME}</span>
          </div>
          <p className="mt-3 text-sm font-medium text-black/60">
            Every AI model. Every provider. Every change.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-black/45">
            Built on open data from{" "}
            <a
              href="https://models.dev"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-black/20 underline-offset-2 transition-colors hover:text-black"
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
              <h4 className="font-hand mb-4 text-lg font-bold text-black">{col.title}</h4>
              <ul className="space-y-2 font-medium text-black/60">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} className="transition-colors hover:text-black">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="transition-colors hover:text-black">
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

      <div className="border-t border-black/5">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-center font-mono text-xs text-black/40">
            © {year} {SITE_NAME} · data updated{" "}
            <time dateTime={stats.snapshotDate ?? undefined}>{fmtDate(stats.snapshotDate)}</time> ·{" "}
            <a
              href="https://www.vakyartha.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-black/20 underline-offset-2 transition-colors hover:text-black"
            >
              A Vakyartha project
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
