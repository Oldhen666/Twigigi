"use client";

import { useActionState } from "react";
import { signIn, signUp } from "@/lib/actions";
import type { FormState } from "@/lib/types";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-danger">{message}</p>;
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signIn, {} as FormState);
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Email</span>
        <input name="email" type="email" autoComplete="email" className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Password</span>
        <input name="password" type="password" autoComplete="current-password" className={inputClass} />
      </label>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}

export function SignupForm({ cta }: { cta?: string }) {
  const [state, action, pending] = useActionState(signUp, {} as FormState);
  return (
    <form action={action} noValidate className="space-y-4">
      {cta ? <input type="hidden" name="cta" value={cta} /> : null}
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Your name</span>
        <input name="displayName" autoComplete="name" className={inputClass} />
        <ErrorText message={state.fieldErrors?.displayName} />
      </label>
      <label className="block">
        <span className={labelClass}>Username</span>
        <input name="username" autoCapitalize="none" autoCorrect="off" placeholder="ava" className={inputClass} />
        <ErrorText message={state.fieldErrors?.username} />
        <span className="mt-1 block text-xs text-muted">Must be unique. Your link will be twigigi.com/username/product</span>
      </label>
      <label className="block">
        <span className={labelClass}>Email</span>
        <input name="email" type="email" autoComplete="email" className={inputClass} />
        <ErrorText message={state.fieldErrors?.email} />
      </label>
      <label className="block">
        <span className={labelClass}>Password</span>
        <input name="password" type="password" autoComplete="new-password" className={inputClass} />
        <ErrorText message={state.fieldErrors?.password} />
      </label>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Creating…" : "Create your Twig"}
      </button>
    </form>
  );
}
