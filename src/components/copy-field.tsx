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
      <code className="min-w-0 flex-1 truncate rounded-md border border-black/15 bg-black/[0.03] px-2.5 py-1.5 font-mono text-xs text-black/70" title={value}>
        {value}
      </code>
      <button
        onClick={copy}
        className="shrink-0 rounded-md border-2 border-black bg-white px-2.5 py-1 text-xs font-semibold shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
      >
        {copied ? "copied ✓" : `copy ${label}`}
      </button>
    </div>
  );
}
