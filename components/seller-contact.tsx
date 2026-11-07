"use client";

import { useEffect, useState } from "react";
import { ghostClass } from "@/components/ui";

export function SellerContactButton({
  mode,
  value,
}: {
  mode: "email" | "phone" | "";
  value: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const href = mode === "email" ? `mailto:${value}` : mode === "phone" ? `tel:${value.replace(/\D/g, "")}` : "";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${ghostClass} mt-3 w-full`}>
        Questions? Contact the seller directly.
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-contact-title"
            className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="seller-contact-title" className="font-serif text-3xl">Contact the seller</h2>
            {href ? (
              <p className="mt-3 text-sm">
                <span className="block text-muted">{mode === "email" ? "Email" : "Phone"}</span>
                <a href={href} className="mt-1 block break-all text-base text-forest">{value}</a>
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">The seller has not added a contact yet.</p>
            )}
            <button type="button" onClick={() => setOpen(false)} className={`${ghostClass} mt-5 w-full`}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
