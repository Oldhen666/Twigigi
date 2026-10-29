"use client";

import { useState } from "react";

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
    `rounded-full px-4 py-2 text-sm font-medium ${on ? "bg-forest text-card" : "border border-line bg-card text-ink"}`;

  return (
    <div className="mt-8">
      <div role="tablist" className="flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={tab === "receiving"} className={tabClass(tab === "receiving")} onClick={() => setTab("receiving")}>
          Receiving Detail for Customer
        </button>
        <button type="button" role="tab" aria-selected={tab === "receipts"} className={tabClass(tab === "receipts")} onClick={() => setTab("receipts")}>
          Twig Receipts
        </button>
      </div>
      <div className="mt-4">{tab === "receiving" ? receiving : receipts}</div>
    </div>
  );
}
