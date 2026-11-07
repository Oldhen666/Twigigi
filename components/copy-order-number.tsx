"use client";

import { useState } from "react";
import { ghostClass } from "@/components/ui";

export function CopyOrderNumber({ value, variant = "button" }: { value: string; variant?: "button" | "link" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (variant === "link") {
    return (
      <button type="button" onClick={copy} aria-live="polite" className="inline-flex items-center gap-1.5 text-sm text-muted">
        <CopyIcon />
        {copied ? "Copied" : "Copy order ID"}
      </button>
    );
  }

  return (
    <button type="button" onClick={copy} aria-live="polite" className={`${ghostClass} w-full`}>
      {copied ? "Copied" : "Copy order number"}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.2" y="5.2" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.8 5.1V3.6A1.4 1.4 0 0 0 9.4 2.2H3.6A1.4 1.4 0 0 0 2.2 3.6v5.8A1.4 1.4 0 0 0 3.6 10.8H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
