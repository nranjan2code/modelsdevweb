"use client";

import { useState } from "react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select the text */
    }
  }
  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border border-black/15 bg-black/5 px-2.5 py-1.5 font-mono text-xs text-black/70" title={value}>
        {value}
      </code>
      <button
        onClick={copy}
        className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold transition-colors hover:border-black"
      >
        {copied ? "copied ✓" : `copy ${label}`}
      </button>
    </div>
  );
}
