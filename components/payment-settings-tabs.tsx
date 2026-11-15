"use client";

import Link from "next/link";
import { useState } from "react";

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function PaymentSettingsTabs({
  initial,
  receiving,
  receipts,
}: {
  initial: "receiving" | "receipts";
  receiving: React.ReactNode;
  receipts: React.ReactNode;
}) {
  const [tab, setTab] = useState(initial);

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Payments section" className="grid max-w-xl grid-cols-2 gap-1 rounded-full border border-line bg-card p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "receiving"}
          onClick={() => setTab("receiving")}
          className={`min-w-0 rounded-full px-3 py-2 text-center text-sm font-medium leading-5 ${focusClass} ${tab === "receiving" ? "bg-forest text-card" : "text-ink"}`}
        >
          Get paid
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "receipts"}
          onClick={() => setTab("receipts")}
          className={`min-w-0 rounded-full px-3 py-2 text-center text-sm font-medium leading-5 ${focusClass} ${tab === "receipts" ? "bg-forest text-card" : "text-ink"}`}
        >
          Pay Twigigi
        </button>
      </div>
      <p className="mt-3 flex max-w-2xl flex-wrap items-baseline gap-x-3 gap-y-1 text-sm leading-6 text-muted">
        {tab === "receiving" ? (
          <>
            <span>Choose how buyers pay you.</span>
            <Link href="/dashboard/help#bank" className={`${focusClass} underline decoration-1 underline-offset-4`}>
              How you get paid →
            </Link>
          </>
        ) : (
          "Manage your listing fees and payment method."
        )}
      </p>
      <div className="mt-4">{tab === "receiving" ? receiving : receipts}</div>
    </div>
  );
}
