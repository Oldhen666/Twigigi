import Link from "next/link";
import { Suspense } from "react";
import { saveBillingMethod } from "@/lib/actions";
import { billingMethodLabel, twigMonthlyCents } from "@/lib/billing";
import { requireUser } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { formatMoney, nextBillingDate, safeNext, formatBillingDate } from "@/lib/format";

async function BillingScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : "/dashboard");
  const user = await requireUser();
  const cents = twigMonthlyCents();
  const chargeLabel = formatBillingDate(nextBillingDate());
  const methods = [
    ["card", "Credit card"],
    ["paypal", "PayPal"],
    ["stripe", "Stripe"],
  ] as const;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <BackButton />
      <div className="flex flex-1 flex-col justify-center py-6">
        <Logo />
        <h1 className="mt-8 font-serif text-4xl">Pay Twigigi</h1>
        <p className="mt-2 text-muted">
          Choose how this account pays for each live Twig. The next charge date is {chargeLabel}.
          {cents ? ` The fee is ${formatMoney(cents, "CAD")} per Twig.` : " The monthly amount is not set yet."}
        </p>
        {user.billingMethod ? (
          <p className="mt-4 text-sm text-forest">Current method: {billingMethodLabel(user.billingMethod)}</p>
        ) : null}
        <form action={saveBillingMethod} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next} />
          {methods.map(([value, label]) => (
            <button key={value} name="method" value={value} className={`${buttonClass} w-full`}>
              {label}
            </button>
          ))}
        </form>
        <p className="mt-4 text-sm text-muted">
          Card numbers are not stored here. Credit card and Stripe charge through the Twigigi Stripe account when it is connected. PayPal is saved as the method for this account.
        </p>
        <p className="mt-4 text-sm">
          <Link href={next} className="text-forest">Continue without changing</Link>
        </p>
      </div>
    </main>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <BillingScreen searchParams={searchParams} />
    </Suspense>
  );
}

export const metadata = { title: "Pay Twigigi", robots: { index: false, follow: false } };
