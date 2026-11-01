"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { submitListingReport } from "@/lib/actions";
import { LISTING_REPORT_REASONS } from "@/lib/legal";
import type { FormState } from "@/lib/types";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";

export function ReportListing({
  productId,
  path,
  title,
  defaultName,
  defaultEmail,
}: {
  productId: string;
  path: string;
  title: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(submitListingReport, {} as FormState);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 bg-transparent p-0 text-xs text-muted underline-offset-2 hover:underline">
        Report listing
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="report-listing-title" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="report-listing-title" className="font-serif text-3xl">Report listing</h2>
            <p className="mt-2 text-sm text-muted">{title}</p>
            {state.saved ? (
              <p className="mt-4 text-sm leading-6">Report received. Twigigi will review it. Submitting a report does not remove the listing.</p>
            ) : (
              <form action={action} className="mt-4 space-y-3">
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="contentUrl" value={path} />
                {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
                <fieldset>
                  <legend className={labelClass}>Reason</legend>
                  <div className="mt-2 space-y-2">
                    {LISTING_REPORT_REASONS.map((item) => (
                      <label key={item.id} className="flex items-start gap-2 text-sm">
                        <input type="radio" name="reason" value={item.id} checked={reason === item.id} onChange={() => setReason(item.id)} className="mt-1" />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  {state.fieldErrors?.reason ? <p className="mt-1 text-sm text-danger">{state.fieldErrors.reason}</p> : null}
                </fieldset>
                {reason === "ip" ? (
                  <p className="text-sm text-muted">
                    For a formal notice, use the{" "}
                    <Link href={`/legal/report-infringement?url=${encodeURIComponent(path)}`} className="text-forest">intellectual property report</Link>.
                    You can still send this shorter note.
                  </p>
                ) : null}
                <label className="block">
                  <span className={labelClass}>Your name</span>
                  <input name="name" defaultValue={defaultName} className={inputClass} />
                  {state.fieldErrors?.name ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.name}</span> : null}
                </label>
                <label className="block">
                  <span className={labelClass}>Email</span>
                  <input name="email" type="email" defaultValue={defaultEmail} className={inputClass} />
                  {state.fieldErrors?.email ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.email}</span> : null}
                </label>
                <label className="block">
                  <span className={labelClass}>What should Twigigi review?</span>
                  <textarea name="description" rows={3} className={`${inputClass} h-auto py-3`} />
                  {state.fieldErrors?.description ? <span className="mt-1 block text-sm text-danger">{state.fieldErrors.description}</span> : null}
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="accurate" value="yes" className="mt-1" />
                  <span>I confirm that this report is accurate.</span>
                </label>
                {state.fieldErrors?.accurate ? <p className="text-sm text-danger">{state.fieldErrors.accurate}</p> : null}
                <button disabled={pending} className={`${buttonClass} w-full`}>{pending ? "Sending…" : "Submit report"}</button>
              </form>
            )}
            <button type="button" onClick={() => setOpen(false)} className={`${ghostClass} mt-3 w-full`}>Close</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
