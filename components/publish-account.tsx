"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import type { FormState } from "@/lib/types";

const ACCOUNT_INPUTS = ["displayName", "username", "email", "password"] as const;

export function PublishAccount({
  open,
  pending,
  state,
  intent,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  state: FormState;
  intent: "draft" | "publish";
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const box = useRef<HTMLDivElement>(null);
  const values = useRef<Record<(typeof ACCOUNT_INPUTS)[number], string>>({
    displayName: "",
    username: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!open || !form) return;
    const onReset = () => {
      window.setTimeout(() => {
        box.current?.querySelectorAll<HTMLInputElement>("input[name]").forEach((input) => {
          if (!ACCOUNT_INPUTS.includes(input.name as (typeof ACCOUNT_INPUTS)[number])) return;
          input.value = values.current[input.name as (typeof ACCOUNT_INPUTS)[number]];
        });
      }, 0);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [open, mode]);

  if (!open) return null;
  const savingDraft = intent === "draft";
  const accountError = ACCOUNT_INPUTS.some((key) => state.fieldErrors?.[key]) ? state.fieldErrors : undefined;

  function remember(event: React.FormEvent<HTMLInputElement>) {
    const name = event.currentTarget.name as (typeof ACCOUNT_INPUTS)[number];
    if (ACCOUNT_INPUTS.includes(name)) values.current[name] = event.currentTarget.value;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-5" onClick={onClose} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="publish-account-title" className="w-full max-w-md rounded-[28px] border border-line bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
        <h2 id="publish-account-title" className="font-serif text-3xl">{savingDraft ? "Save your draft" : "Publish your Twig"}</h2>
        <p className="mt-2 text-sm text-muted">
          {mode === "login"
            ? "Log in to save this Twig to your account. What you already filled in stays on this page."
            : "Create your account first. Your name and link are created now, and this Twig is saved to that account."}
        </p>
        <input type="hidden" name="accountMode" value={mode} />
        {state.error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
        <div className="mt-4 space-y-4">
          {mode === "register" ? (
            <>
              <Field label="Your name" error={accountError?.displayName}>
                <input name="displayName" autoComplete="name" defaultValue={values.current.displayName} onInput={remember} className={inputClass} />
              </Field>
              <Field label="Username" error={accountError?.username}>
                <input name="username" autoCapitalize="none" autoCorrect="off" placeholder="ava" defaultValue={values.current.username} onInput={remember} className={inputClass} />
                <span className="mt-1 block text-xs text-muted">Shown on your page. The link uses a permanent ID.</span>
              </Field>
            </>
          ) : null}
          <Field label="Email" error={accountError?.email}>
            <input name="email" type="email" autoComplete="email" defaultValue={values.current.email} onInput={remember} className={inputClass} />
          </Field>
          <Field label="Password" error={accountError?.password}>
            <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} defaultValue={values.current.password} onInput={remember} className={inputClass} />
          </Field>
        </div>
        <button name="intent" value={intent} disabled={pending} className={`${buttonClass} mt-5 w-full`}>
          {pending
            ? "Saving…"
            : mode === "login"
              ? savingDraft
                ? "Log in and save draft"
                : "Log in and publish"
              : savingDraft
                ? "Create account and save draft"
                : "Create account and publish"}
        </button>
        <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className={`${ghostClass} mt-2 w-full`}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : null}
    </label>
  );
}
