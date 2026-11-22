"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { confirmDigitalPlan } from "@/lib/actions";
import { platformFee } from "@/lib/billing";
import { platformOrderFeeCents } from "@/lib/digital-plans";
import { buttonClass } from "@/components/ui";

export type DigitalChoice = {
  planId: string;
  copies: number;
  name: string;
  slots: string;
  monthlyCents: number;
  feeBps: number;
  monthlyLabel: string;
  rateLabel: string;
  dueLabel: string;
  current: boolean;
};

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={`${buttonClass} mt-5 w-full`} disabled={disabled || pending}>
      {pending ? "Confirming…" : "Confirm plan"}
    </button>
  );
}

function centsFromInput(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return cents > 0 ? cents : null;
}

export function DigitalPlanPicker({
  choices,
  salesCents,
  salesLabel,
}: {
  choices: DigitalChoice[];
  salesCents: number | null;
  salesLabel: string;
}) {
  const [selectedId, setSelectedId] = useState(choices.find((choice) => choice.current)?.planId ?? choices[0]?.planId ?? "");
  const [draftSales, setDraftSales] = useState("");
  const typedCents = salesCents == null ? centsFromInput(draftSales) : null;
  const amount = salesCents ?? typedCents;
  const usingEstimate = salesCents == null;
  const totals = choices.map((choice) => ({
    ...choice,
    total: amount == null ? null : choice.monthlyCents + platformOrderFeeCents(amount, choice.feeBps),
  }));
  const ranked = totals.filter((choice) => choice.total != null).sort((left, right) => (left.total ?? 0) - (right.total ?? 0));
  const cheapest = ranked[0];
  const next = ranked[1];
  const saveCents = cheapest && next && cheapest.total != null && next.total != null ? next.total - cheapest.total : 0;
  const saveCopy = saveCents > 0 && cheapest && next
    ? `${usingEstimate ? "Estimated save" : "Save"} ${platformFee(saveCents, "CAD")}/month with ${cheapest.copies > 1 ? `${cheapest.name} × ${cheapest.copies}` : cheapest.name}, compared with ${next.copies > 1 ? `${next.name} × ${next.copies}` : next.name}, on the same chargeable sales.`
    : "";
  const selected = totals.find((choice) => choice.planId === selectedId) ?? null;

  return (
    <div className="mt-6">
      <p className="text-sm leading-6 text-muted">{salesLabel}</p>
      {salesCents == null ? (
        <label className="mt-3 block text-sm">
          Expected monthly chargeable sales (CAD)
          <input
            inputMode="decimal"
            value={draftSales}
            onChange={(event) => setDraftSales(event.target.value)}
            placeholder="1500.00"
            className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-3"
          />
        </label>
      ) : null}
      <div role="radiogroup" aria-label="Digital File plans" className="mt-4 rounded-xl border border-line bg-card p-2">
        {totals.map((choice, index) => {
          const checked = choice.planId === selectedId;
          return (
            <label key={choice.planId} className={`flex cursor-pointer items-start justify-between gap-3 px-3 py-3 ${checked ? "rounded-md bg-moss" : index > 0 ? "border-t border-line" : ""}`}>
              <span className="flex min-w-0 items-start gap-3">
                <input
                  type="radio"
                  name="digital-plan"
                  value={choice.planId}
                  checked={checked}
                  onChange={() => setSelectedId(choice.planId)}
                  className="mt-1 size-4 shrink-0 accent-forest"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{choice.copies > 1 ? `${choice.name} × ${choice.copies}` : choice.name}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{choice.slots} · {choice.rateLabel} platform order fee</span>
                  {choice.current ? <span className="mt-0.5 block text-xs text-muted">Current plan</span> : null}
                  {saveCopy && cheapest?.planId === choice.planId ? <span className="mt-1 block text-xs leading-5">{saveCopy}</span> : null}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block whitespace-nowrap text-sm font-semibold tabular-nums">{choice.monthlyLabel}</span>
                {choice.total != null ? (
                  <span className="mt-0.5 block whitespace-nowrap text-xs tabular-nums text-muted">{platformFee(choice.total, "CAD")}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">Stripe and PayPal payment processing fees are separate and are not included.</p>
      {selected && amount != null ? (
        <p className="mt-2 text-sm leading-6">
          {usingEstimate ? "Estimated monthly platform fees" : "Monthly subscription + platform order fees"}: {platformFee(selected.total ?? 0, "CAD")}.
        </p>
      ) : null}
      {selected ? (
        <form action={confirmDigitalPlan}>
          <input type="hidden" name="plan" value={selected.planId} />
          <input type="hidden" name="copies" value={selected.copies} />
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt>Due today</dt>
              <dd className="text-xl font-semibold tabular-nums">{selected.dueLabel}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-muted">
              <dt>Renews monthly</dt>
              <dd className="tabular-nums">{selected.monthlyLabel}</dd>
            </div>
          </dl>
          <ConfirmButton disabled={selected.current} />
        </form>
      ) : null}
    </div>
  );
}
