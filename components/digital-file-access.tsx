"use client";

import { useState } from "react";
import { confirmReceipt, reportDigitalFileIssue } from "@/lib/actions";
import { CopyText } from "@/components/copy-text";
import { CopyOrderNumber } from "@/components/copy-order-number";
import { ReviewSeller } from "@/components/review-seller";
import { SellerContactButton } from "@/components/seller-contact";
import { buttonClass, ghostClass } from "@/components/ui";

const ISSUES = [
  { id: "link", label: "Link doesn't work" },
  { id: "access", label: "Access denied" },
  { id: "password", label: "Incorrect password" },
  { id: "file", label: "Wrong or missing file" },
];

export function DigitalFileAccess({
  orderId,
  orderNumber,
  links,
  password,
  accessConfirmed,
  issue,
  helpSent,
  contactMode,
  contactValue,
  interactionId,
  productTitle,
  reviewed,
}: {
  orderId: string;
  orderNumber: string;
  links: string[];
  password: string;
  accessConfirmed: boolean;
  issue: string;
  helpSent: boolean;
  contactMode: "email" | "phone" | "";
  contactValue: string;
  interactionId: string;
  productTitle: string;
  reviewed: boolean;
}) {
  const [help, setHelp] = useState(helpSent || Boolean(issue));
  const primary = links[0] ?? "";
  const host = fileHost(primary);

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-3xl border border-line bg-white px-4 py-4">
        <h2 className="font-semibold">Your file is ready</h2>
        <p className="mt-1 text-sm text-muted">Your seller has provided access to your digital file.</p>
        {primary ? (
          <div className="mt-4 rounded-2xl border border-line bg-paper-deep px-4 py-3">
            <div>
              <p className="font-medium">{host}</p>
              <p className="text-sm text-muted">External download link</p>
            </div>
            {password ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                <span className="text-muted">Access password</span>
                <span className="flex items-center gap-2 font-medium">
                  {password}
                  <CopyText value={password} label="Copy" className="inline-flex h-7 items-center rounded-full border border-line bg-white px-2 text-xs" />
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">The seller has not added a file link yet.</p>
        )}
        {primary ? (
          <a href={primary} target="_blank" rel="noreferrer" className={`${buttonClass} mt-4 w-full`}>
            Open your file
          </a>
        ) : null}
        {links.slice(1).map((link, index) => (
          <a key={link} href={link} target="_blank" rel="noreferrer" className={`${ghostClass} mt-2 w-full`}>
            Open file {index + 2}
          </a>
        ))}
        {primary ? <p className="mt-2 text-center text-sm text-muted">Opens the seller's external file link.</p> : null}
      </section>

      {primary ? (
        <section className="rounded-3xl border border-line bg-white px-4 py-4">
          <h2 className="font-semibold">Was everything okay with your file?</h2>
          <p className="mt-1 text-sm text-muted">Let the seller know whether you could open it. Confirming file access does not mark the order complete.</p>
          {accessConfirmed ? (
            <p className="mt-3 text-sm text-forest">You confirmed that the file opened.</p>
          ) : issue || helpSent ? (
            <p className="mt-3 text-sm text-muted">Sent to the seller{issue ? `: ${issue}` : ""}. You can contact them below. This does not change the order.</p>
          ) : help ? (
            <form action={reportDigitalFileIssue} className="mt-4 space-y-2">
              <input type="hidden" name="id" value={orderId} />
              {ISSUES.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
                  <input type="radio" name="reason" value={item.id} required className="accent-forest" />
                  {item.label}
                </label>
              ))}
              <button className={`${buttonClass} w-full`}>Send to the seller</button>
            </form>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <form action={confirmReceipt}>
                <input type="hidden" name="id" value={orderId} />
                <button className={`${ghostClass} w-full`}>Confirm file access</button>
              </form>
              <button type="button" onClick={() => setHelp(true)} className={`${ghostClass} w-full`}>
                I need help
              </button>
            </div>
          )}
        </section>
      ) : null}

      {(accessConfirmed || reviewed) && interactionId ? (
        <section className="rounded-3xl border border-line bg-white px-4 py-4">
          <h2 className="font-semibold">Rate your experience</h2>
          <p className="mt-1 text-sm text-muted">Share it after you can open the file.</p>
          <ReviewSeller interactionId={interactionId} kind="order" productTitle={productTitle} reviewed={reviewed} label="Rate your experience" />
        </section>
      ) : null}

      {accessConfirmed && !interactionId ? <p className="text-center text-sm text-muted">Sign in with this email to rate the seller.</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <SellerContactButton mode={contactMode} value={contactValue} variant="link" />
        {orderNumber ? <CopyOrderNumber value={orderNumber} variant="link" /> : null}
        <button type="button" onClick={() => window.print()} className="text-sm font-medium text-forest">
          Print receipt
        </button>
      </div>
    </div>
  );
}

function fileHost(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("drive.google.com") || host === "docs.google.com") return "Google Drive file";
    if (host.includes("dropbox.com")) return "Dropbox file";
    if (host.includes("1drv.ms") || host.includes("onedrive.live.com")) return "OneDrive file";
    return "Download file";
  } catch {
    return "Download file";
  }
}
