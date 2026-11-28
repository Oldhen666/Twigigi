"use client";

import { adminTransferTwig } from "@/lib/actions";
import { inputClass } from "@/components/ui";

export function AdminTransferTwig({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={adminTransferTwig}
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const seller = new FormData(form).get("seller");
        const name = typeof seller === "string" ? seller.trim() : "";
        if (!name || !window.confirm(`Transfer “${title}” to ${name}? It becomes a draft on their account, and they pay when they publish it.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input name="seller" required placeholder="Seller email or username" className={`${inputClass} w-64 max-w-full`} />
      <button className="text-forest">Transfer</button>
    </form>
  );
}
