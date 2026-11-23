"use client";

import { useState } from "react";
import { platformFee } from "@/lib/billing";
import { compareDigitalCoverage, formatFeeRate, listingLimitLabel } from "@/lib/digital-plans";
import { inputClass } from "@/components/ui";

function centsFromInput(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

function planLabel(name: string, copies: number) {
  return copies > 1 ? `${name} × ${copies}` : name;
}

export function PricingEstimator() {
  const [listings, setListings] = useState("18");
  const [sales, setSales] = useState("1500.00");
  const needed = /^\d+$/.test(listings.trim()) ? Number(listings.trim()) : null;
  const salesCents = centsFromInput(sales);
  const ready = needed != null && needed >= 1 && salesCents != null;
  const ranked = ready ? compareDigitalCoverage(needed, salesCents) : [];
  const best = ranked[0];
  const next = ranked[1];
  const saveCents = best && next ? next.totalCents - best.totalCents : 0;

  return (
    <div className="mt-6">
      <h3 className="font-serif text-2xl">Estimate a month</h3>
      <p className="mt-2 text-sm leading-6 text-muted">Compare plans that cover the same listings, using the same chargeable sales. The lower total includes the monthly price and the platform order fee.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Listings you need
          <input
            inputMode="numeric"
            value={listings}
            onChange={(event) => setListings(event.target.value)}
            className={`${inputClass} mt-1.5`}
          />
        </label>
        <label className="block text-sm font-medium">
          Expected monthly chargeable sales (CAD)
          <input
            inputMode="decimal"
            value={sales}
            onChange={(event) => setSales(event.target.value)}
            className={`${inputClass} mt-1.5`}
          />
        </label>
      </div>
      {!ready ? <p className="mt-3 text-sm leading-6 text-muted">Enter at least 1 listing and a sales amount, including 0.</p> : null}
      {ready && ranked.length > 0 ? (
        <div className="mt-4 space-y-3">
          {ranked.map((quote) => {
            const label = planLabel(quote.plan.name, quote.copies);
            const recommended = saveCents > 0 && quote === best;
            return (
              <article key={`${quote.plan.id}-${quote.copies}`} className={`rounded-2xl border px-4 py-4 ${recommended ? "border-forest bg-moss" : "border-line bg-card"}`}>
                <p className="font-medium">{label}</p>
                <p className="mt-0.5 text-sm text-muted">{quote.listingLimit == null ? "No listing cap" : `${listingLimitLabel(quote.listingLimit)} listings`}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt>Monthly price</dt>
                    <dd className="tabular-nums">{platformFee(quote.monthlyCents, "CAD")}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt>Platform order fee · {formatFeeRate(quote.feeBps)}</dt>
                    <dd className="tabular-nums">{platformFee(quote.orderFeeCents, "CAD")}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt>Estimated total</dt>
                    <dd className="font-serif text-2xl tabular-nums">{platformFee(quote.totalCents, "CAD")}</dd>
                  </div>
                </dl>
                {recommended && next ? (
                  <p className="mt-3 text-sm leading-6">
                    <span className="font-semibold text-forest">Save {platformFee(saveCents, "CAD")}/month</span> with {label}, compared with {planLabel(next.plan.name, next.copies)}, for {needed} {needed === 1 ? "listing" : "listings"} and {platformFee(salesCents, "CAD")} chargeable sales.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
