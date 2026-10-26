"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { ProductOption, ProductVariant } from "@/lib/types";
import { resolveSelection, variantKey } from "@/lib/variants";

export function BuyPicker({
  username,
  slug,
  currency,
  priceCents,
  buttonLabel,
  options,
  variants,
  samePrice,
  quantityAvailable,
  children,
}: {
  username: string;
  slug: string;
  currency: string;
  priceCents: number;
  buttonLabel: string;
  options: ProductOption[];
  variants: ProductVariant[];
  samePrice: boolean;
  quantityAvailable: number | null;
  children?: React.ReactNode;
}) {
  const [selected, setSelected] = useState(() => options.map((option) => option.values[0] ?? ""));
  const cap = quantityAvailable == null ? 20 : Math.min(20, quantityAvailable);
  const [quantity, setQuantity] = useState(1);
  const selection = resolveSelection(
    { hasOptions: true, samePrice, options, variants, priceCents },
    variantKey(selected),
  );
  const soldOut = cap < 1;
  const unavailable = !selection || !selection.available || selection.priceCents == null;
  const unit = selection?.priceCents ?? priceCents;
  const href = (() => {
    const params = new URLSearchParams();
    params.set("v", variantKey(selected));
    if (quantity > 1) params.set("qty", String(quantity));
    return `/${username}/${slug}/buy?${params.toString()}`;
  })();

  return (
    <>
      <div className="mt-4 space-y-4">
        {options.map((option, index) => (
          <div key={option.name}>
            <p className="text-sm font-medium">{option.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[index] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))}
                    className={`rounded-full border px-3 py-1.5 text-sm ${active ? "border-forest bg-moss text-forest" : "border-line bg-white text-ink"}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {soldOut ? null : (
          <div>
            <p className="text-sm font-medium">Quantity</p>
            <div className="mt-2 inline-flex items-center rounded-full border border-line">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="h-10 w-10 text-lg">
                −
              </button>
              <span className="w-8 text-center text-sm">{quantity}</span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => Math.min(cap, current + 1))} className="h-10 w-10 text-lg">
                +
              </button>
            </div>
          </div>
        )}
        <p className="font-serif text-3xl text-forest">{formatMoney(unit, currency)}</p>
      </div>
      {children}
      <div className="sticky bottom-0 z-10 -mx-5 mt-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
        {soldOut || unavailable ? (
          <span className="flex h-14 items-center justify-center rounded-2xl bg-paper-deep text-lg text-muted">
            {soldOut ? "Sold out" : "Unavailable"}
          </span>
        ) : (
          <Link href={href} className="flex h-14 items-center justify-center rounded-2xl bg-forest text-lg text-card">
            {buttonLabel || "Buy now"}
          </Link>
        )}
      </div>
    </>
  );
}
