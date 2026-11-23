"use client";

import { useState } from "react";
import { adminRemoveUser } from "@/lib/actions";

export function RemoveUserForm({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 block text-sm text-danger">
        Remove user
      </button>
    );
  }
  return (
    <form action={adminRemoveUser} className="mt-2 grid max-w-44 gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirm" value="yes" />
      <p className="text-xs leading-5 text-danger">Delete {name}? This removes the account, its Twigs, and the orders on those Twigs.</p>
      <div className="flex gap-3">
        <button className="text-sm text-danger">Delete</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Cancel</button>
      </div>
    </form>
  );
}
