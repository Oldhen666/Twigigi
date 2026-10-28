"use client";

import { useState } from "react";
import { reactivateTwig, scheduleDeactivation } from "@/lib/actions";
import { buttonClass, ghostClass } from "@/components/ui";

export function DeactivateTwig({
  productId,
  mode,
  endsLabel,
  deleteLabel,
}: {
  productId: string;
  mode: "live" | "ending" | "deactivated";
  endsLabel: string;
  deleteLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const reactivating = mode !== "live";
  const title = reactivating ? "Reactivate this Twig" : "Deactivate this Twig";
  const body = reactivating
    ? mode === "ending"
      ? `This cancels the deactivation set for ${endsLabel}. The Twig stays live, and it will not be deleted on ${deleteLabel}.`
      : `This publishes the Twig again and the link works. The permanent deletion set for ${deleteLabel} is canceled.`
    : `The next charge on ${endsLabel} is canceled, and this page becomes inactive now. Pay again to publish it. If you do not reactivate, it is permanently deleted on ${deleteLabel}.`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`ml-auto font-medium ${reactivating ? "text-forest" : "text-danger"}`}>
        {reactivating ? "Reactivate" : "Deactivate"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="deactivate-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="deactivate-title" className="font-serif text-3xl">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
            <form action={reactivating ? reactivateTwig : scheduleDeactivation} className="mt-5">
              <input type="hidden" name="id" value={productId} />
              <button className={`${buttonClass} w-full`}>{reactivating ? "Reactivate" : "Deactivate"}</button>
            </form>
            <button type="button" onClick={() => setOpen(false)} className={`${ghostClass} mt-2 w-full`}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
