"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { confirmBuyPlan } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

export type BuyBundleRow = {
  id: string;
  label: string;
  price: string;
  due: string;
  renewal: string;
  slots: string;
  current: boolean;
  confirmable: boolean;
};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button className={`${buttonClass} mt-5 w-full`} disabled={pending}>
      {pending ? "Confirming…" : "Confirm subscription"}
    </button>
  );
}

export function BuyBundlePicker({ rows, initialId }: { rows: BuyBundleRow[]; initialId: string }) {
  const [selectedId, setSelectedId] = useState(initialId);
  const [reviewing, setReviewing] = useState(false);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const canReview = Boolean(selected && !selected.current);

  return (
    <div className="mt-6">
      <div role="radiogroup" aria-label="Buy Now bundles" className="rounded-xl border border-line bg-card p-2">
        {rows.map((row, index) => {
          const checked = row.id === selectedId;
          return (
            <label
              key={row.id}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-3 ${checked ? "rounded-md bg-moss" : index > 0 ? "border-t border-line" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <input
                  type="radio"
                  name="buy-bundle"
                  value={row.id}
                  checked={checked}
                  onChange={() => {
                    setSelectedId(row.id);
                    setReviewing(false);
                  }}
                  className="size-4 shrink-0 accent-forest"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{row.label}</span>
                  {row.current ? <span className="mt-0.5 block text-xs text-muted">Current plan</span> : null}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{row.price}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">Only published Buy Now listings use a slot.</p>
      {reviewing && selected ? (
        <section className="mt-5 rounded-xl border border-line bg-card p-5">
          {selected.confirmable ? (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt>Due today</dt>
                  <dd className="text-xl font-semibold tabular-nums">{selected.due}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 text-muted">
                  <dt>Renews monthly</dt>
                  <dd className="tabular-nums">{selected.renewal}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-6">{selected.slots}</p>
              <form action={confirmBuyPlan}>
                <input type="hidden" name="plan" value={selected.id} />
                <input type="hidden" name="extra" value="0" />
                <input type="hidden" name="add" value="0" />
                <ConfirmButton />
              </form>
            </>
          ) : (
            <p className="text-sm leading-6">This bundle does not cover the listings already published.</p>
          )}
          <button type="button" className="mt-3 text-sm text-muted" onClick={() => setReviewing(false)}>Back</button>
        </section>
      ) : (
        <button type="button" className={`${buttonClass} mt-5 w-full`} disabled={!canReview} onClick={() => setReviewing(true)}>
          Review subscription
        </button>
      )}
    </div>
  );
}
