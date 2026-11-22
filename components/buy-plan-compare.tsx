"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type ComparePlanRow = {
  id: string;
  name: string;
  detail: string;
  price: string;
  period: string;
};

export function BuyPlanCompare({
  productId,
  rows,
  selectedId,
  initiallyOpen,
  title,
  subtitle,
}: {
  productId: string;
  rows: ComparePlanRow[];
  selectedId: string;
  initiallyOpen: boolean;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [pending, setPending] = useState<string | null>(null);
  const active = pending ?? selectedId;

  useEffect(() => {
    if (initiallyOpen) setOpen(true);
  }, [initiallyOpen]);

  useEffect(() => {
    setPending(null);
  }, [selectedId]);

  function choose(id: string) {
    if (id === active) return;
    setPending(id);
    const params = new URLSearchParams();
    params.set("draft", productId);
    params.set("compare", "1");
    if (id !== "listing") params.set("choice", id);
    router.push(`/dashboard/buy?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs leading-5 text-muted">{subtitle}</span> : null}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={`size-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}>
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div role="radiogroup" aria-label="Listing plans" className="mt-3">
          {rows.map((row, index) => {
            const checked = row.id === active;
            return (
              <label
                key={row.id}
                className={`flex cursor-pointer items-center justify-between gap-3 px-2 py-2.5 ${checked ? "rounded-md bg-moss" : index > 0 ? "border-t border-line" : ""}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="radio"
                    name="buy-listing-plan"
                    value={row.id}
                    checked={checked}
                    onChange={() => choose(row.id)}
                    className="size-4 shrink-0 accent-forest"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{row.name}</span>
                    {row.detail ? <span className="mt-0.5 block text-xs leading-5 text-muted">{row.detail}</span> : null}
                  </span>
                </span>
                <span className="shrink-0 text-right leading-5">
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{row.price}</span>
                  <span className="block text-xs text-muted sm:ml-2 sm:inline">{row.period}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
