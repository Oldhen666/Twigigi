"use client";

import { useEffect, useRef, useState } from "react";
import { saleCurrency } from "@/lib/billing";
import { inputClass, labelClass } from "@/components/ui";
import {
  QUOTE_PRICE_MODE_OPTIONS,
  QUOTE_PRICE_UNIT_OPTIONS,
  centsToQuoteInput,
  quotePriceFromProduct,
  quotePriceLabel,
  quotePriceReady,
  type QuotePriceMode,
  type QuotePriceUnit,
} from "@/lib/quote-price";
import type { Product } from "@/lib/types";

function draftCents(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return cents > 0 ? cents : null;
}

export function QuotePriceFields({ product, errors }: { product?: Product; errors: Record<string, string> }) {
  const saved = quotePriceFromProduct(product ?? { priceCents: null, currency: "CAD" });
  const [mode, setMode] = useState<QuotePriceMode>(saved.mode);
  const [unit, setUnit] = useState<QuotePriceUnit>(saved.unit);
  const [unitName, setUnitName] = useState(saved.unitName);
  const [amount, setAmount] = useState(centsToQuoteInput(saved.mode === "range" ? null : saved.amountCents));
  const [minimum, setMinimum] = useState(centsToQuoteInput(saved.mode === "range" ? saved.amountCents : null));
  const [maximum, setMaximum] = useState(centsToQuoteInput(saved.maxCents));
  const [currency, setCurrency] = useState(saved.currency);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const sync = () => {
      const location = (form.querySelector('[name="location"]') as HTMLInputElement | null)?.value ?? "";
      setCurrency(saleCurrency({ cta: "quote", location }));
    };
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, []);

  const previewPrice = {
    mode,
    amountCents: mode === "range" ? draftCents(minimum) : mode === "custom" ? null : draftCents(amount),
    maxCents: mode === "range" ? draftCents(maximum) : null,
    unit,
    unitName,
    currency,
  };
  const ready = quotePriceReady(previewPrice);
  const preview = ready ? quotePriceLabel(previewPrice) : "";
  const previewHint = mode !== "custom" && unit === "custom" && !unitName.trim() ? "Enter a unit name to preview what customers see." : "Enter the amount to preview what customers see.";

  return (
    <div ref={rootRef} className="space-y-4">
      <label className="block">
        <span className={labelClass}>Price display</span>
        <select name="quotePriceMode" value={mode} onChange={(event) => setMode(event.target.value as QuotePriceMode)} className={inputClass}>
          {QUOTE_PRICE_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      {mode === "starting" || mode === "set" ? (
        <label className="block">
          <span className={labelClass}>{mode === "starting" ? "Starting amount" : "Amount"}</span>
          <input name="quotePriceAmount" inputMode="decimal" value={amount} placeholder="8" onChange={(event) => setAmount(event.target.value)} className={inputClass} />
          {errors.quotePriceAmount ? <span className="mt-1 block text-sm text-danger">{errors.quotePriceAmount}</span> : null}
        </label>
      ) : null}
      {mode === "range" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Minimum amount</span>
            <input name="quotePriceMin" inputMode="decimal" value={minimum} placeholder="8" onChange={(event) => setMinimum(event.target.value)} className={inputClass} />
            {errors.quotePriceMin ? <span className="mt-1 block text-sm text-danger">{errors.quotePriceMin}</span> : null}
          </label>
          <label className="block">
            <span className={labelClass}>Maximum amount</span>
            <input name="quotePriceMax" inputMode="decimal" value={maximum} placeholder="12" onChange={(event) => setMaximum(event.target.value)} className={inputClass} />
            {errors.quotePriceMax ? <span className="mt-1 block text-sm text-danger">{errors.quotePriceMax}</span> : null}
          </label>
        </div>
      ) : null}
      {mode !== "custom" ? (
        <label className="block">
          <span className={labelClass}>Pricing unit</span>
          <select name="quotePriceUnit" value={unit} onChange={(event) => setUnit(event.target.value as QuotePriceUnit)} className={inputClass}>
            {QUOTE_PRICE_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}
      {mode !== "custom" && unit === "custom" ? (
        <label className="block">
          <span className={labelClass}>Unit name</span>
          <input name="quotePriceUnitName" value={unitName} maxLength={40} placeholder="e.g. linear ft" onChange={(event) => setUnitName(event.target.value)} className={inputClass} />
          {errors.quotePriceUnitName ? <span className="mt-1 block text-sm text-danger">{errors.quotePriceUnitName}</span> : null}
        </label>
      ) : null}
      <div className="rounded-2xl border border-line bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Customer preview</p>
        <p className={`mt-2 font-serif text-2xl ${ready ? "text-forest" : "text-muted"}`}>{ready ? preview : previewHint}</p>
      </div>
    </div>
  );
}
