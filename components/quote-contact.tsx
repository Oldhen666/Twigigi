"use client";

import { useEffect, useState } from "react";
import { CopyText } from "@/components/copy-text";
import { ghostClass } from "@/components/ui";

export function QuoteContact({ email, phone, contact }: { email: string; phone: string; contact: string }) {
  const [open, setOpen] = useState<"phone" | "email" | null>(null);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = open === "phone" ? phone : email;
  return (
    <>
      <div className={`mt-3 grid gap-2 ${phone ? "grid-cols-3" : "grid-cols-2"}`}>
        {phone ? <Tile label="Call" icon="phone" onClick={() => setOpen("phone")} /> : null}
        <Tile label="Email" icon="mail" onClick={() => setOpen("email")} />
        <CopyText value={contact} label="Copy contact" className="inline-flex h-auto w-full flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-3 text-sm text-ink" />
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-contact-title"
            className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="quote-contact-title" className="font-serif text-3xl">{open === "phone" ? "Phone" : "Email"}</h2>
            <p className="mt-3 break-all text-base">{value}</p>
            <CopyText value={value} label="Copy" className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest px-5 text-base font-medium text-card" />
            <button type="button" onClick={() => setOpen(null)} className={`${ghostClass} mt-2 w-full`}>Close</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tile({ label, icon, onClick }: { label: string; icon: "phone" | "mail"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-3 text-sm text-ink">
      {icon === "phone" ? (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3.2 2.6h2.1l1 2.4-1.3 1.1a8.4 8.4 0 0 0 3.9 3.9l1.1-1.3 2.4 1v2.1c0 .6-.5 1.1-1.1 1.1A10.3 10.3 0 0 1 2.1 3.7c0-.6.5-1.1 1.1-1.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2.2 4.1 8 8.4l5.8-4.3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </button>
  );
}
