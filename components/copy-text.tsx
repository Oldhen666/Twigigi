"use client";

import { useState } from "react";

export function CopyText({ value, label = "Copy", className = "" }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const text = value.startsWith("/") ? `${window.location.origin}${value}` : value;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={className || "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-xs"}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="5.2" y="5.2" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10.8 5.1V3.6A1.4 1.4 0 0 0 9.4 2.2H3.6A1.4 1.4 0 0 0 2.2 3.6v5.8A1.4 1.4 0 0 0 3.6 10.8H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {copied ? "Copied" : label}
    </button>
  );
}
