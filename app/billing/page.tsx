import Link from "next/link";
import { Suspense } from "react";
import { saveBillingMethod } from "@/lib/actions";
import { QUOTE_SUBMISSION_CENTS } from "@/lib/billing";
import { requireUser } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { formatMoney, safeNext } from "@/lib/format";

async function BillingScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : "/dashboard");
  const user = await requireUser();
  const quoteRequest = formatMoney(QUOTE_SUBMISSION_CENTS);
  const cardSelected = user.billingMethod !== "paypal";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
      <BackButton href={next} />
      <div className="flex flex-1 flex-col justify-center py-6">
        <Logo />
        <h1 className="mt-8 font-serif text-4xl">Twigigi fees</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted">Choose how you will pay Twigigi before a Twig can be published. This does not charge you and does not save a card.</p>
        <div className="mt-6 max-w-prose space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-6">
            <span>Buy now or quote listing</span>
            <span>C$1.49 or USD$1.49 / 30 days</span>
          </div>
          <p className="text-muted">A Canadian listing is CAD. A United States listing is USD. A digital file is always C$1.49 / 30 days.</p>
          <div className="flex items-baseline justify-between gap-6">
            <span>Valid quote request</span>
            <span>{quoteRequest} each</span>
          </div>
          <p className="text-muted">Quote fees stay unpaid until the next listing payment in the same currency. Twigigi does not charge a quote by itself.</p>
        </div>
        <form action={saveBillingMethod} className="mt-8">
          <input type="hidden" name="next" value={next} />
          <fieldset>
            <legend className="text-sm font-medium">Payment method</legend>
            <label className="mt-4 flex cursor-pointer gap-3">
              <input type="radio" name="method" value="card" defaultChecked={cardSelected} className="mt-1 accent-forest" />
              <span>
                <span className="block">Credit or debit card</span>
                <span className="mt-0.5 block text-sm text-muted">Visa · Mastercard · Amex</span>
              </span>
            </label>
            <label className="mt-4 flex cursor-pointer items-center gap-3">
              <input type="radio" name="method" value="paypal" defaultChecked={!cardSelected} className="accent-forest" />
              <span>PayPal</span>
            </label>
          </fieldset>
          <p className="mt-4 max-w-prose text-sm leading-6 text-muted">
            Choosing a method here only records your preference. Save a card, see the balance, and download bills on Twigigi fees.
          </p>
          <button className={`${buttonClass} mt-6 w-full sm:w-fit`}>Continue</button>
        </form>
        <p className="mt-4 text-sm">
          <Link href="/dashboard/payments?tab=receipts" className="text-forest">Open Pay Twigigi</Link>
        </p>
        <p className="mt-2 text-sm">
          <Link href={next} className="text-muted">Continue without changing</Link>
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

export const metadata = { title: "Twigigi fees", robots: { index: false, follow: false } };
