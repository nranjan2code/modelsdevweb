import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { getSnapshotMeta, getVerifiedOffers } from "@/lib/data";

export async function generateStaticParams() {
  const params = (await getVerifiedOffers()).map((offer) => ({ id: offer.id }));
  // Next static export requires at least one generated param even before the
  // first daily offer has been discovered.
  return params.length > 0 ? params : [{ id: "__no-offer__" }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const offers = await getVerifiedOffers();
  const offer = offers.find((item) => item.id === id);
  return { title: offer ? `${offer.modelName} free offer` : "Free offer" };
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [offers, meta] = await Promise.all([getVerifiedOffers(), getSnapshotMeta()]);
  const offer = offers.find((item) => item.id === id);
  if (!offer) notFound();
  const isExpired = offer.expiresOn != null && meta.date != null && offer.expiresOn < meta.date;
  return (
    <article className="space-y-6">
      <header className="page-intro">
        <Link href="/offers" className="mono-label text-accent hover:text-accent-strong">← Free offers log</Link>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone={isExpired ? "warn" : "pos"}>{isExpired ? "Expired" : "Verified offer"}</Badge><span className="micro-label">{offer.providerName}</span></div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-black sm:text-4xl">{offer.modelName} was offered free</h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-black/70">{offer.offer}</p>
      </header>
      <dl className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div><dt className="mono-label">What</dt><dd className="mt-1 text-black/70">{offer.offer}</dd></div>
        <div><dt className="mono-label">Who</dt><dd className="mt-1 text-black/70">{offer.providerName}</dd></div>
        <div><dt className="mono-label">Where</dt><dd className="mt-1"><a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">{offer.sourceHost} ↗</a></dd></div>
        <div><dt className="mono-label">When</dt><dd className="mt-1 text-black/70">{offer.startsOn ?? "Not stated"} → {offer.expiresOn ?? "Not stated"}</dd></div>
        <div className="sm:col-span-2"><dt className="mono-label">How it works</dt><dd className="mt-1 text-black/70">Use the provider’s listed model endpoint under its stated quota, credits, or campaign terms. Limits can change; the source page is authoritative.</dd></div>
      </dl>
      <div className="border-t border-black/10 pt-4 text-xs leading-relaxed text-black/60">
        Last verified {offer.verifiedAt}. Evidence captured from the first-party page: “{offer.evidence}”
      </div>
    </article>
  );
}
