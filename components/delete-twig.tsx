"use client";

import { useState } from "react";
import { removeProduct } from "@/lib/actions";
import { ghostClass } from "@/components/ui";

export function DeleteTwig({ productId, mode = "draft" }: { productId: string; mode?: "draft" | "deactivated" }) {
  const [open, setOpen] = useState(false);
  const retired = mode === "deactivated";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`font-medium text-danger ${retired ? "ml-auto" : ""}`}>
        Delete
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-twig-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="delete-twig-title" className="font-serif text-3xl">{retired ? "Delete this Twig" : "Delete this draft"}</h2>
            {retired ? (
              <div className="mt-2 space-y-2 text-sm text-muted">
                <p>This permanently deletes the Twig. It cannot be recovered.</p>
                <p>The deactivation payment terms are canceled. Any time already paid is not refunded, and this Twig cannot be turned back on.</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">This permanently deletes the draft. It cannot be undone.</p>
            )}
            <form action={removeProduct} className="mt-5">
              <input type="hidden" name="id" value={productId} />
              <button className="inline-flex h-12 w-full items-center justify-center rounded-full bg-danger px-5 text-base font-medium text-card">
                {retired ? "Delete Twig" : "Delete draft"}
              </button>
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
