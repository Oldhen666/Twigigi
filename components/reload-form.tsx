"use client";

import { useActionState, useEffect } from "react";
import type { FormState } from "@/lib/types";

export function ReloadForm({
  action,
  className = "",
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  useEffect(() => {
    if (state.next) window.location.assign(state.next);
  }, [state.next]);
  return (
    <form action={formAction}>
      <fieldset disabled={pending} className={`min-w-0 border-0 p-0 disabled:opacity-60 ${className}`}>
        {children}
      </fieldset>
      {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
