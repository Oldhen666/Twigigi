"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitIpReport } from "@/lib/actions";
import { RIGHT_TYPES } from "@/lib/legal";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

export function IpReportForm({
  defaultName,
  defaultEmail,
  defaultUrl,
}: {
  defaultName: string;
  defaultEmail: string;
  defaultUrl: string;
}) {
  const [state, action, pending] = useActionState(submitIpReport, {} as FormState);
  if (state.saved) {
    return (
      <div className="mt-8 rounded-[28px] border border-line bg-card p-6">
        <h2 className="font-serif text-3xl">Report received</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Twigigi will review what you sent. Submitting a report does not remove the listing.</p>
        <Link href="/legal/intellectual-property" className={`${buttonClass} mt-5`}>Back to the policy</Link>
      </div>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Full name</span>
        <input name="name" defaultValue={defaultName} className={inputClass} />
        {state.fieldErrors?.name ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.name}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>Company or organization, optional</span>
        <input name="company" className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Email</span>
        <input name="email" type="email" defaultValue={defaultEmail} className={inputClass} />
        {state.fieldErrors?.email ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.email}</span> : null}
      </label>
      <fieldset>
        <legend className={labelClass}>Type of right</legend>
        <div className="mt-2 space-y-2">
          {RIGHT_TYPES.map((right) => (
            <label key={right.id} className="flex items-center gap-2">
              <input type="radio" name="rightType" value={right.id} />
              {right.label}
            </label>
          ))}
        </div>
        {state.fieldErrors?.rightType ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.rightType}</p> : null}
      </fieldset>
      <label className="block">
        <span className={labelClass}>Protected work or right</span>
        <textarea name="protectedWork" rows={3} className={`${inputClass} h-auto py-3`} placeholder="Describe the work, mark, design, or patent you own or represent." />
        {state.fieldErrors?.protectedWork ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.protectedWork}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>Listing or content URL</span>
        <input name="contentUrl" defaultValue={defaultUrl} className={inputClass} placeholder="https:// or /seller/listing" />
        {state.fieldErrors?.contentUrl ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.contentUrl}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>How the listing infringes</span>
        <textarea name="description" rows={4} className={`${inputClass} h-auto py-3`} />
        {state.fieldErrors?.description ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.description}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>Supporting information</span>
        <textarea name="evidence" rows={3} className={`${inputClass} h-auto py-3`} placeholder="Registration numbers, links to the original work, or other details a reviewer can check." />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="accurate" value="yes" className="mt-1" />
        <span>I confirm that the information in this report is accurate.</span>
      </label>
      {state.fieldErrors?.accurate ? <p className="text-sm text-danger">{state.fieldErrors.accurate}</p> : null}
      <label className="block">
        <span className={labelClass}>Electronic signature</span>
        <input name="signature" className={inputClass} placeholder="Type your legal name" />
        {state.fieldErrors?.signature ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.signature}</span> : null}
      </label>
      <button disabled={pending} className={`${buttonClass} w-full`}>{pending ? "Sending…" : "Submit report"}</button>
    </form>
  );
}
