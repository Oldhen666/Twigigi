"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn, signUp } from "@/lib/actions";
import type { FormState } from "@/lib/types";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";

function useContinue(next?: string) {
  useEffect(() => {
    if (next) window.location.assign(next);
  }, [next]);
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-danger">{message}</p>;
}

export function LoginHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="mt-6 text-sm text-muted">
        Having a problem?{" "}
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-forest">
          Contact
        </button>
      </p>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="login-help-title" className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <h2 id="login-help-title" className="font-serif text-3xl">Contact</h2>
            <p className="mt-3 text-sm text-muted">Email</p>
            <a href="mailto:chenk@dybridge.com" className="mt-1 block text-base text-forest">chenk@dybridge.com</a>
            <button type="button" onClick={() => setOpen(false)} className={`${ghostClass} mt-5 w-full`}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(signIn, {} as FormState);
  useContinue(state.next);
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
      <p className="text-sm text-muted">
        <a href="/forgot" className="text-forest">Forgot password?</a>
      </p>
    </form>
  );
}

export function SignupForm({ cta, initialRole = "seller" }: { cta?: string; initialRole?: "seller" | "buyer" }) {
  const [state, action, pending] = useActionState(signUp, {} as FormState);
  useContinue(state.next);
  const [role, setRole] = useState<"seller" | "buyer">(initialRole);
  return (
    <form action={action} noValidate className="space-y-4">
      {cta ? <input type="hidden" name="cta" value={cta} /> : null}
      <input type="hidden" name="role" value={role} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setRole("buyer")} className={`h-11 rounded-full border text-sm ${role === "buyer" ? "border-forest bg-moss text-forest" : "border-line bg-card text-muted"}`}>
          Buy
        </button>
        <button type="button" onClick={() => setRole("seller")} className={`h-11 rounded-full border text-sm ${role === "seller" ? "border-forest bg-moss text-forest" : "border-line bg-card text-muted"}`}>
          Sell
        </button>
      </div>
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Your name</span>
        <input name="displayName" autoComplete="name" className={inputClass} />
        <ErrorText message={state.fieldErrors?.displayName} />
      </label>
      {role === "seller" ? (
        <label className="block">
          <span className={labelClass}>Username</span>
          <input name="username" autoCapitalize="none" autoCorrect="off" placeholder="ava" className={inputClass} />
          <ErrorText message={state.fieldErrors?.username} />
          <span className="mt-1 block text-xs text-muted">Must be unique. Your link will be twigigi.com/username/product</span>
        </label>
      ) : (
        <p className="text-sm text-muted">A buyer account keeps the orders placed with this email.</p>
      )}
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
        {pending ? "Creating…" : role === "buyer" ? "Create buyer account" : "Create your Twig"}
      </button>
    </form>
  );
}
