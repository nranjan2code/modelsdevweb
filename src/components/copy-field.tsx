"use client";

import { useState } from "react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("failed");
    }
  }
  return (
    <div className="flex items-stretch gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border border-black/15 bg-black/5 px-2.5 py-1.5 font-mono text-xs text-black/70" title={value}>
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="control-button shrink-0"
      >
        {status === "copied" ? "copied ✓" : status === "failed" ? `select and copy ${label}` : `copy ${label}`}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "copied" ? `${label} copied` : status === "failed" ? `Could not copy ${label}; select the text and copy it manually` : ""}
      </span>
    </div>
  );
}
