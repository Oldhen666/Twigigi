"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitCopyrightAppeal } from "@/lib/actions";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

export function CopyrightAppealForm({ products }: { products: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(submitCopyrightAppeal, {} as FormState);
  if (state.saved) {
    return (
      <div className="mt-8 rounded-[28px] border border-line bg-card p-6">
        <h2 className="font-serif text-3xl">Review request received</h2>
        <p className="mt-3 text-sm leading-6 text-muted">An administrator will read what you sent. Sending this request does not restore a listing or an account.</p>
        <Link href="/legal/copyright" className={`${buttonClass} mt-5`}>Back to the Copyright Policy</Link>
      </div>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Listing, if one is affected</span>
        <select name="productId" className={inputClass} defaultValue="">
          <option value="">No single listing</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select>
        {state.fieldErrors?.productId ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.productId}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>Why this should be reviewed</span>
        <textarea name="statement" rows={5} className={`${inputClass} h-auto py-3`} />
        {state.fieldErrors?.statement ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.statement}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>Supporting evidence</span>
        <textarea name="evidence" rows={4} className={`${inputClass} h-auto py-3`} placeholder="Links to a licence, permission, or other documents an administrator can open." />
      </label>
      <button disabled={pending} className={`${buttonClass} w-full`}>{pending ? "Sending…" : "Request a review"}</button>
    </form>
  );
}
