"use client";

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
      <label className="block max-w-md">
        <span className="sr-only">Payments section</span>
        <select
          value={tab}
          onChange={(event) => setTab(event.target.value === "receipts" ? "receipts" : "receiving")}
          className={`h-12 w-full rounded-xl border border-line bg-card px-3 text-base font-medium text-ink ${focusClass}`}
        >
          <option value="receiving">Setup payment for your customer</option>
          <option value="receipts">Twigigi Subscription</option>
        </select>
      </label>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        {tab === "receiving" ? "Choose how buyers pay you." : "Manage your listing fees and renewal payment method."}
      </p>
      <div className="mt-4">{tab === "receiving" ? receiving : receipts}</div>
    </div>
  );
}
