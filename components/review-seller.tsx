"use client";

import { useState } from "react";
import { ReviewForm } from "@/components/review-form";
import { buttonClass } from "@/components/ui";

export function ReviewSeller({
  interactionId,
  kind,
  productTitle,
  reviewed,
  enabled = true,
  label = "Review the seller",
}: {
  interactionId: string;
  kind: "order" | "quote";
  productTitle: string;
  reviewed: boolean;
  enabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  if (reviewed) return <p className="mt-3 text-sm text-muted">Reviewed</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass} mt-3 w-full`}>
        {label}
      </button>
    );
  }
  return (
    <div className="mt-3">
      <ReviewForm interactionId={interactionId} kind={kind} productTitle={productTitle} />
    </div>
  );
}
