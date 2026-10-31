"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";
import type { Cta } from "@/lib/types";

const OPTIONS = [
  { id: "buy", title: "Buy now", detail: "They pay you directly." },
  { id: "file", title: "Digital file", detail: "They pay, then Twigigi emails the file link and password." },
  { id: "quote", title: "Get a quote", detail: "They send their details. You reply with a price." },
] as const;

export function RespondChoice({ signedIn }: { signedIn: boolean }) {
  const [cta, setCta] = useState<Cta | null>(null);
  const router = useRouter();

  return (
    <div>
      <h1 className="font-serif text-4xl">How should buyers respond?</h1>
      <div className="mt-6 space-y-3">
        {OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`block cursor-pointer rounded-2xl border px-4 py-3 ${cta === option.id ? "border-forest bg-moss" : "border-line bg-white"}`}
          >
            <input
              type="radio"
              name="cta"
              value={option.id}
              checked={cta === option.id}
              onChange={() => setCta(option.id)}
              className="mr-2 accent-forest"
            />
            <span className="font-medium">{option.title}</span>
            <span className="mt-1 block pl-6 text-sm text-muted">{option.detail}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={!cta}
        className={`${buttonClass} mt-6 w-full`}
        onClick={() => {
          if (!cta) return;
          router.push(signedIn ? `/dashboard/products/new?cta=${cta}` : `/new?cta=${cta}`);
        }}
      >
        Next
      </button>
    </div>
  );
}
