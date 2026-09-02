import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui";
import { getSnapshotMeta, getVerifiedOffers } from "@/lib/data";

export const metadata: Metadata = {
  title: "Free offers",
  description: "A verified log of temporary free AI model offers and provider promotions.",
  alternates: { canonical: "/offers" },
};

function expired(expiresOn: string | null, asOf: string | null): boolean {
  return expiresOn != null && asOf != null && expiresOn < asOf;
}

export default async function OffersPage() {
  const [offers, meta] = await Promise.all([getVerifiedOffers(), getSnapshotMeta()]);
  return (
    <div className="space-y-6">
      <header className="page-intro page-intro-split">
        <p className="mono-label">Promotion watch</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Free offers</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          Temporary free access, credits and campaigns verified against first-party provider pages. Expired offers stay here as a market log.
        </p>
      </header>
      {offers.length === 0 ? <EmptyState>No verified offers yet — the daily checker is watching provider pages.</EmptyState> : (
        <div className="divide-y divide-black/10 border-y border-black/15">
          {offers.map((offer) => {
            const isExpired = expired(offer.expiresOn, meta.date);
            return (
              <article key={offer.id} className="py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={isExpired ? "warn" : "pos"}>{isExpired ? "Expired" : "Live when checked"}</Badge>
                  <span className="micro-label">{offer.providerName}</span>
                </div>
                <h2 className="mt-2 text-lg font-bold"><Link href={`/offers/${offer.id}`} className="hover:text-accent">{offer.modelName}</Link></h2>
                <p className="mt-1 text-sm text-black/70">{offer.offer}</p>
                <p className="mt-2 text-xs text-black/60">
                  {offer.startsOn ? `From ${offer.startsOn}` : "Start date not stated"}{offer.expiresOn ? ` · ended ${offer.expiresOn}` : " · end date not stated"} · verified {offer.verifiedAt.slice(0, 10)}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
