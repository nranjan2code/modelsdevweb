import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { ChangelogList } from "@/components/changelog-list";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Hourly changelog of the AI model landscape: releases, repricings, deprecations, context and capability changes.",
  alternates: { canonical: "/changelog" },
};

export default async function ChangelogPage() {
  const events = await getEvents();
  return (
    <div className="space-y-6">
      <header className="page-intro page-intro-split">
        <p className="mono-label">Hourly diffs</p>
        <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Changelog</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-black/60">
          Every detected change to the model landscape: releases, price moves, context windows, capabilities
          and deprecations. Also available as{" "}
          <a href="/rss.xml" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
            RSS
          </a>{" "}
          or{" "}
          <a href="/api/events.json" className="font-medium text-accent underline decoration-wavy underline-offset-4 hover:text-accent-strong">
            JSON
          </a>
          .
        </p>
      </header>
      <ChangelogList events={events} />
    </div>
  );
}
