"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveBillingMethod } from "@/lib/actions";
import { buttonClass } from "@/components/ui";

type Method = "card" | "paypal";

function MethodRow({
  name,
  value,
  checked,
  onSelect,
}: {
  name: string;
  value: Method;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest ${checked ? "border-forest bg-moss" : "border-line bg-card"}`}>
      <input
        type="radio"
        name="method"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="size-4 shrink-0 accent-forest"
      />
      <span className="text-sm font-medium">{name}</span>
    </label>
  );
}

export function BillingPreferenceForm({
  next,
  saved,
  paypalAvailable,
}: {
  next: string;
  saved: "" | "card" | "paypal" | "stripe";
  paypalAvailable: boolean;
}) {
  const initial: Method | "" = saved === "paypal" && paypalAvailable
    ? "paypal"
    : saved === "card" || saved === "stripe" || !paypalAvailable
      ? "card"
      : "";
  const [method, setMethod] = useState<Method | "">(initial);
  const [state, action, pending] = useActionState(saveBillingMethod, {});
  const canKeep = saved === "card" || saved === "stripe" || saved === "paypal";

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="next" value={next} />
      <fieldset className="rounded-xl border border-line bg-card p-3">
        <legend className="sr-only">How you pay Twigigi fees</legend>
        <div className="space-y-2">
          <MethodRow name="Credit or debit card" value="card" checked={method === "card"} onSelect={() => setMethod("card")} />
          {paypalAvailable ? <MethodRow name="PayPal" value="paypal" checked={method === "paypal"} onSelect={() => setMethod("paypal")} /> : null}
        </div>
      </fieldset>
      <p className="mt-4 text-sm leading-6 text-muted">Saving your preference won’t charge you or save a card.</p>
      {state.error ? <p className="mt-3 text-sm leading-6 text-clay" role="alert">{state.error}</p> : null}
      <button className={`${buttonClass} mt-4 w-full`} disabled={pending}>
        {pending ? "Saving preference…" : "Save preference and continue"}
      </button>
      {canKeep ? (
        <Link href={next} className="mt-3 block text-center text-sm text-muted">Continue without changing</Link>
      ) : null}
    </form>
  );
}
