import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, groupContext, groupReleaseDate } from "@/lib/data";
import { LabModelsTable } from "@/components/catalog-tables";

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

  return (
    <div className="space-y-6">
      <nav className="text-sm text-black/60">
        <Link href="/browse" className="transition-colors hover:text-accent">
          Browse
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-black">{lab}</span>
      </nav>
      <header className="page-intro">
        <p className="mono-label">Lab</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">{lab}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          {groups.length} canonical models tracked ·{" "}
          <a
            href={`/feeds/${lab}/rss.xml`}
            className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong"
          >
            RSS feed for this lab
          </a>
        </p>
      </header>

      <LabModelsTable rows={groups.map((group) => ({ id: group.id, name: group.name, input: group.best?.input ?? null, output: group.best?.output ?? null, context: groupContext(group), providers: group.listings.length, released: groupReleaseDate(group) }))} />
    </div>
  );
}
