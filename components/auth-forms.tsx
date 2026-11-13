"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
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

function PasswordField({ autoComplete }: { autoComplete: "current-password" | "new-password" }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input name="password" type={visible ? "text" : "password"} autoComplete={autoComplete} aria-label="Password" className={`${inputClass} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-2 right-2 h-8 rounded-full px-2 text-sm font-medium text-forest"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
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
      <div className="block">
        <span className={labelClass}>Password</span>
        <PasswordField autoComplete="current-password" />
      </div>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Signing in…" : "Log in"}
      </button>
      <p className="text-sm text-muted">
        <a href="/forgot" className="text-forest">Forgot password?</a>
      </p>
    </form>
  );
}

export function SignupForm({ cta, email = "", nextPath = "" }: { cta?: string; email?: string; nextPath?: string }) {
  const [state, action, pending] = useActionState(signUp, {} as FormState);
  useContinue(state.next);
  return (
    <form action={action} noValidate className="space-y-4">
      {cta ? <input type="hidden" name="cta" value={cta} /> : null}
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      {state.error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <label className="block">
        <span className={labelClass}>Your name</span>
        <input name="displayName" autoComplete="name" className={inputClass} />
        <ErrorText message={state.fieldErrors?.displayName} />
      </label>
      <label className="block">
        <span className={labelClass}>Username</span>
        <input name="username" autoCapitalize="none" autoCorrect="off" placeholder="ava" className={inputClass} />
        <span className="mt-1 block text-xs text-muted">Shown on your page. The link uses a permanent ID.</span>
        <ErrorText message={state.fieldErrors?.username} />
      </label>
      <label className="block">
        <span className={labelClass}>Email</span>
        <input name="email" type="email" autoComplete="email" defaultValue={email} className={inputClass} />
        <ErrorText message={state.fieldErrors?.email} />
      </label>
      <label className="block">
        <span className={labelClass}>Password</span>
        <input name="password" type="password" autoComplete="new-password" className={inputClass} />
        <ErrorText message={state.fieldErrors?.password} />
      </label>
      <p className="text-sm leading-6 text-muted">
        By creating an account, you agree to Twigigi&apos;s <Link href="/legal/terms" className="text-forest">Terms of Service</Link> and <Link href="/legal/privacy" className="text-forest">Privacy Policy</Link>.
      </p>
      <button disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
