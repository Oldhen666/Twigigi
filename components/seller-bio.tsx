"use client";

import { useActionState, useEffect, useState } from "react";
import { updateSellerBio } from "@/lib/actions";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function SellerBio({ bio, next }: { bio: string; next: string }) {
  const [state, action, pending] = useActionState(updateSellerBio, {} as FormState);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!state.next) return;
    if (state.next === window.location.pathname) window.location.reload();
    else window.location.assign(state.next);
  }, [state.next]);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="mt-3 block text-left text-sm leading-6 text-muted">
        {bio || "Seller bio and business information can appear here."}
      </button>
    );
  }

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="next" value={next} />
      <textarea
        name="bio"
        aria-label="Seller bio"
        defaultValue={bio}
        maxLength={280}
        rows={3}
        placeholder="Seller bio and business information can appear here."
        className={`${inputClass} h-auto py-2 text-sm`}
      />
      <div className="mt-2 flex gap-4 text-sm">
        <button className="font-medium text-forest">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} className="text-muted">Cancel</button>
      </div>
    </form>
  );
}
