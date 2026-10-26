"use client";

import { useState } from "react";
import { removeProduct } from "@/lib/actions";
import { ghostClass } from "@/components/ui";

export function DeleteTwig({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-danger">
        Delete
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-twig-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="delete-twig-title" className="font-serif text-3xl">Delete this draft</h2>
            <p className="mt-2 text-sm text-muted">This permanently deletes the draft. It cannot be undone.</p>
            <form action={removeProduct} className="mt-5">
              <input type="hidden" name="id" value={productId} />
              <button className="inline-flex h-12 w-full items-center justify-center rounded-full bg-danger px-5 text-base font-medium text-card">Delete draft</button>
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
