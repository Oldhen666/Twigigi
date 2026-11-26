"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export function PasswordInput({
  name,
  autoComplete,
  defaultValue,
  onInput,
}: {
  name: string;
  autoComplete: "current-password" | "new-password";
  defaultValue?: string;
  onInput?: (event: React.FormEvent<HTMLInputElement>) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        onInput={onInput}
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1 grid h-10 w-10 -translate-y-1/2 place-items-center text-muted"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M2.2 12S5.8 6.2 12 6.2 21.8 12 21.8 12 18.2 17.8 12 17.8 2.2 12 2.2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M3 3.8 20.2 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.8 6.5A10 10 0 0 1 12 6.2c6.2 0 9.8 5.8 9.8 5.8a17 17 0 0 1-3.1 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.2 7.1C3.7 8.8 2.2 12 2.2 12s3.6 5.8 9.8 5.8c1.5 0 2.9-.3 4.1-.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.7 9.9a2.6 2.6 0 0 0 3.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
