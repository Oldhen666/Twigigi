"use client";

import { adminDeleteTwig } from "@/lib/actions";

export function AdminDeleteTwig({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={adminDeleteTwig}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${title}? The listing is removed. Existing orders stay.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-danger">Delete</button>
    </form>
  );
}
