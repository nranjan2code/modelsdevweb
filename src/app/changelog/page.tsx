import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { ChangelogList } from "@/components/changelog-list";

export const metadata: Metadata = { title: "Changelog" };

export default async function ChangelogPage() {
  const events = await getEvents();
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Changelog</h1>
        <p className="text-sm text-zinc-500">
          Every detected change to the model landscape: releases, price moves, context windows, capabilities
          and deprecations. Also available as{" "}
          <a href="/rss.xml" className="text-emerald-400 hover:text-emerald-300">
            RSS
          </a>{" "}
          or{" "}
          <a href="/api/events.json" className="text-emerald-400 hover:text-emerald-300">
            JSON
          </a>
          .
        </p>
      </header>
      <ChangelogList events={events} />
    </div>
  );
}
