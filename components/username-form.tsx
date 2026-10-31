"use client";

import { useActionState } from "react";
import { updateAccountUsername } from "@/lib/actions";
import { inputClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function UsernameForm({ username, next }: { username: string; next: string }) {
  const [state, action, pending] = useActionState(updateAccountUsername, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="username" aria-label="Username" autoCapitalize="none" autoCorrect="off" defaultValue={username} className={`${inputClass} h-10 w-44 text-sm`} />
      <input type="hidden" name="next" value={next} />
      <button disabled={pending} className="text-sm font-medium text-forest">
        {pending ? "Saving…" : "Save"}
      </button>
      {state.fieldErrors?.username ? <span className="text-sm text-danger">{state.fieldErrors.username}</span> : null}
    </form>
  );
}
