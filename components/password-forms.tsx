"use client";

import { useActionState } from "react";
import { requestPasswordReset, resetPassword } from "@/lib/actions";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-danger">{message}</p>;
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as FormState);
  if (state.saved) {
    return <p className="rounded-2xl bg-card px-4 py-3 text-sm text-muted">If an account uses that email, we sent a reset link. It expires in one hour.</p>;
  }
  return (
    <form action={action} noValidate className="space-y-4">
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Email</span>
        <input name="email" type="email" autoComplete="email" className={inputClass} />
        <ErrorText message={state.fieldErrors?.email} />
      </label>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, {} as FormState);
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>New password</span>
        <input name="password" type="password" autoComplete="new-password" className={inputClass} />
        <ErrorText message={state.fieldErrors?.password} />
      </label>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
