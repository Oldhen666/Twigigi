"use client";

import { useState } from "react";

export function BuyerRecordSwitch({ orders, quotes }: { orders: React.ReactNode; quotes: React.ReactNode }) {
  const [shown, setShown] = useState<"orders" | "quotes">("orders");
  return (
    <div className="mt-8">
      <label className="flex items-center gap-3">
        <span className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Show</span>
        <select
          value={shown}
          onChange={(event) => setShown(event.target.value === "quotes" ? "quotes" : "orders")}
          className="h-11 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
        >
          <option value="orders">Orders</option>
          <option value="quotes">Quotes</option>
        </select>
      </label>
      {shown === "orders" ? orders : quotes}
    </div>
  );
}
