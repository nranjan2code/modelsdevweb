import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { FIELD_NOTES } from "@/lib/field-notes";

export const metadata: Metadata = {
  title: "Field notes",
  description: "Practical explainers about API keys, quotas, billing, routing and capacity in the AI model market.",
  alternates: { canonical: "/field-notes" },
};

export default function FieldNotesPage() {
  return (
    <div className="space-y-10">
      <header className="page-intro page-intro-split">
        <p className="mono-label text-accent">Field notes · the infrastructure behind the market</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">How the AI market works</h1>
        <p className="max-w-2xl text-base leading-relaxed text-black/60">
          Model prices are the visible tape. These notes explain the machinery underneath: keys, quotas,
          billing, gateways, routing and the capacity that stays off the dashboard.
        </p>
      </header>

      <section className="grid max-w-5xl gap-4 md:grid-cols-2">
        {FIELD_NOTES.map((note, index) => {
          const published = note.status === "published";
          return (
            <article key={note.slug} className={`card flex flex-col gap-4 p-5 ${index === 0 ? "md:col-span-2 md:p-7" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="mono-label text-special">{note.eyebrow}</p>
                <Badge tone={published ? "pos" : "muted"}>{published ? "Read" : "Coming soon"}</Badge>
              </div>
              <div>
                <h2 className={`${index === 0 ? "text-2xl sm:text-3xl" : "text-xl"} font-bold tracking-tight text-black`}>
                  {note.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">{note.summary}</p>
              </div>
              {published ? (
                <Link href={`/field-notes/${note.slug}`} className="mt-auto inline-flex min-h-11 items-center self-start border-b border-accent/40 text-sm font-semibold text-accent hover:border-accent">
                  Read the field note →
                </Link>
              ) : (
                <p className="mono-label mt-auto text-black/45">The outline is on the desk.</p>
              )}
            </article>
          );
        })}
      </section>

      <section className="card-dashed max-w-3xl p-5">
        <p className="mono-label text-warn">Editorial rule</p>
        <p className="mt-2 text-sm leading-relaxed text-black/70">
          A provider-reported limit is a fact about an account or endpoint. A successful request is an
          observation. Neither one is a promise about tomorrow&apos;s capacity.
        </p>
      </section>
    </div>
  );
}

