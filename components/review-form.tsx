"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveReview } from "@/lib/actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function ReviewForm({ orderId, productTitle }: { orderId: string; productTitle: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveReview, {} as FormState);
  useEffect(() => {
    if (state.saved) router.refresh();
  }, [router, state.saved]);
  return (
    <form action={action} className="rounded-2xl border border-line bg-card p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <p className="font-medium">{productTitle}</p>
      {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      <label className="mt-3 block">
        <span className={labelClass}>Rating</span>
        <select name="rating" defaultValue="5" className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base">
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
        {state.fieldErrors?.rating ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.rating}</span> : null}
      </label>
      <label className="mt-3 block">
        <span className={labelClass}>Review</span>
        <textarea name="body" rows={3} className={`${inputClass} h-auto py-3`} placeholder="How did it go?" />
      </label>
      <button disabled={pending} className={`${buttonClass} mt-4`}>
        {pending ? "Saving…" : "Save review"}
      </button>
    </form>
  );
}
