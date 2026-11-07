"use client";

import { useState } from "react";

export function TwigMore({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="rounded-full border border-line bg-white px-4 py-2 text-sm">
        More
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-card p-2 text-sm shadow">
          {children}
        </div>
      ) : null}
    </div>
  );
}
