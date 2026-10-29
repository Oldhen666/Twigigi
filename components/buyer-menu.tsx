"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const LINKS = [
  ["Orders", "/orders"],
  ["Saved", "/saved"],
  ["Browse history", "/history"],
] as const;

export function BuyerMenu({ active }: { active: boolean }) {
  const path = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onPointerDown={(event) => {
          pointer.current = event.pointerType;
        }}
        onClick={() => {
          if (pointer.current === "mouse" && open) return;
          setOpen((value) => !value);
        }}
        className={`inline-flex items-center gap-1 bg-transparent p-0 ${active ? "font-medium text-forest" : "text-ink"}`}
      >
        Buying
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="mt-0.5 opacity-70">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 pt-2">
          <div role="menu" className="min-w-44 rounded-2xl border border-line bg-card py-1.5 shadow-[0_16px_40px_rgba(28,25,21,0.08)]">
            {LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 hover:bg-paper-deep ${path === href ? "font-medium text-forest" : "text-ink"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
