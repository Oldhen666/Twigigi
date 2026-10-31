"use client";

import { useActionState, useEffect, useState } from "react";
import { updateAccountUsername } from "@/lib/actions";
import { buttonClass, inputClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

export function UsernameForm({ username, next }: { username: string; next: string }) {
  const [state, action, pending] = useActionState(updateAccountUsername, {} as FormState);
  const [open, setOpen] = useState(false);
  const error = state.fieldErrors?.username ?? state.error;

  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  useEffect(() => {
    if (!state.next) return;
    if (state.next === window.location.pathname) window.location.reload();
    else window.location.assign(state.next);
  }, [state.next]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md hover:text-ink">
        {username}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5"
          onClick={() => { if (!pending) setOpen(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        >
          <form
            action={action}
            role="dialog"
            aria-modal="true"
            aria-labelledby="username-title"
            className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="username-title" className="font-serif text-3xl">Username</h2>
            <p className="mt-2 text-sm text-muted">Shown on your page. The link stays the same.</p>
            <input type="hidden" name="next" value={next} />
            <input
              name="username"
              aria-label="Username"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              defaultValue={username}
              className={`${inputClass} mt-4`}
            />
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <button type="submit" disabled={pending} className={`${buttonClass} mt-4 w-full`}>
              {pending ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
