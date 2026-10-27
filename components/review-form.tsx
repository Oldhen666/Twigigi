"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveReview } from "@/lib/actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

const SCORES = [
  ["overall", "Overall"],
  ["asDescribed", "As described"],
  ["communication", "Communication"],
  ["reliability", "Reliability"],
] as const;

export function ReviewForm({
  interactionId,
  productTitle,
  kind,
}: {
  interactionId: string;
  productTitle: string;
  kind: "order" | "quote";
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveReview, {} as FormState);
  useEffect(() => {
    if (state.saved) router.refresh();
  }, [router, state.saved]);
  const scores = kind === "quote" ? [...SCORES, ["quality", "Quality of work/product"] as const] : SCORES;
  return (
    <form action={action} className="rounded-2xl border border-line bg-card p-4">
      <input type="hidden" name="interactionId" value={interactionId} />
      <p className="font-medium">{productTitle}</p>
      {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state.fieldErrors?.overall ? <p className="mt-2 text-sm text-danger">{state.fieldErrors.overall}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {scores.map(([name, label]) => (
          <label key={name} className="block">
            <span className={labelClass}>{label}</span>
            <select name={name} defaultValue="5" className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base">
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </label>
        ))}
      </div>
      <label className="mt-3 block">
        <span className={labelClass}>Review</span>
        <textarea name="body" rows={3} className={`${inputClass} h-auto py-3`} placeholder="How did it go?" />
      </label>
      <label className="mt-3 block">
        <span className={labelClass}>Photos</span>
        <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
        <span className="mt-1 block text-xs text-muted">Up to 2 photos.</span>
        {state.fieldErrors?.images ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.images}</span> : null}
      </label>
      <button disabled={pending} className={`${buttonClass} mt-4`}>
        {pending ? "Saving…" : "Save review"}
      </button>
    </form>
  );
}
