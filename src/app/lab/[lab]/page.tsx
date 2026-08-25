import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, groupContext, groupReleaseDate, providerCount } from "@/lib/data";
import { activeGroups, labRetirement, retiredGroups, retirementOf } from "@/lib/data/retirement";
import { LabModelsTable } from "@/components/catalog-tables";
import { Badge } from "@/components/ui";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  const labIds = new Set(catalog.groups.map((g) => g.labId));
  return [...labIds].map((lab) => ({ lab }));
}

export async function generateMetadata({ params }: { params: Promise<{ lab: string }> }): Promise<Metadata> {
  const { lab } = await params;
  return { title: `${lab} models` };
}

export default async function LabPage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  const catalog = await getCatalog();
  const groups = catalog.groups.filter((g) => g.labId === lab);
  if (groups.length === 0) notFound();

  // A model no provider serves any more is not something this lab offers, so it
  // is counted and listed separately rather than padding the headline number.
  const counts = labRetirement(groups);
  const active = activeGroups(groups);
  const retired = retiredGroups(groups);

  const toRow = (group: (typeof groups)[number]) => ({
    id: group.id,
    name: group.name,
    input: group.best?.input ?? null,
    output: group.best?.output ?? null,
    context: groupContext(group),
    providers: providerCount(group),
    withdrawn: retirementOf(group).retiredProviders.length,
    released: groupReleaseDate(group),
  });

  return (
    <div className="space-y-6">
      <nav className="text-sm text-black/60">
        <Link href="/browse" className="transition-colors hover:text-accent">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{lab}</span>
      </nav>
      <header className="page-intro page-intro-split">
        <p className="mono-label">Lab</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{lab}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          {counts.active} model{counts.active === 1 ? "" : "s"} currently served
          {counts.retired > 0 && <> · {counts.retired} fully retired</>}
          {counts.partial > 0 && <> · {counts.partial} withdrawn by at least one provider</>}
          {" · "}
          <a
            href={`/feeds/${lab}/rss.xml`}
            className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
          >
            RSS feed for this lab
          </a>
        </p>
      </header>

      <LabModelsTable rows={active.map(toRow)} />

      {retired.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="neg">Retired</Badge>
            <h2 className="text-lg font-bold tracking-tight text-black">
              No longer served anywhere
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-black/60">
            Every provider has withdrawn these. They are kept on the record because a pinned
            endpoint may still be in someone&apos;s code, but they are excluded from the counts
            above and from every aggregate on the site.
          </p>
          <LabModelsTable rows={retired.map(toRow)} />
        </section>
      )}
    </div>
  );
}
