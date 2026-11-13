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
  const tabClass = (on: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium ${focusClass} ${on ? "bg-forest text-card" : "border border-line bg-card text-ink"}`;

  return (
    <div className="mt-8">
      <div role="tablist" className="flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={tab === "receiving"} className={tabClass(tab === "receiving")} onClick={() => setTab("receiving")}>
          Get paid
        </button>
        <button type="button" role="tab" aria-selected={tab === "receipts"} className={tabClass(tab === "receipts")} onClick={() => setTab("receipts")}>
          Pay Twigigi
        </button>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        {tab === "receiving" ? "Choose how buyers pay you." : "Manage your listing fees and renewal payment method."}
      </p>
      <div className="mt-4">{tab === "receiving" ? receiving : receipts}</div>
    </div>
  );
}
