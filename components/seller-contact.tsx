"use client";

import { useEffect, useState } from "react";
import { ghostClass } from "@/components/ui";

export function SellerContactButton({
  mode,
  value,
  variant = "button",
}: {
  mode: "email" | "phone" | "";
  value: string;
  variant?: "button" | "link";
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
      <button type="button" onClick={() => setOpen(true)} className={variant === "link" ? "inline-flex items-center gap-1.5 text-sm text-forest" : `${ghostClass} mt-3 w-full`}>
        {variant === "link" ? (
          <>
            <ChatIcon />
            Contact seller
          </>
        ) : (
          "Questions? Contact the seller directly."
        )}
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

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.2 12.6 2.4 14.2c.2 0 2.2-.7 2.2-.7A6 6 0 1 0 3.2 12.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
