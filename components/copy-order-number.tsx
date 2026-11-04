"use client";

import { useState } from "react";
import { ghostClass } from "@/components/ui";

export function CopyOrderNumber({ value }: { value: string }) {
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

  return (
    <button type="button" onClick={copy} aria-live="polite" className={`${ghostClass} w-full`}>
      {copied ? "Copied" : "Copy order number"}
    </button>
  );
}
