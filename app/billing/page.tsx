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
      <BackButton />
      <div className="flex flex-1 flex-col justify-center py-6">
        <Logo />
        <h1 className="mt-8 font-serif text-4xl">Billing & Payment</h1>
        <p className="mt-2 text-muted">Add a payment method for your Twigigi fees.</p>
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-6">
            <span>Active Buy Now or Quote listing</span>
            <span>C$1.49 or USD$1.49 / month</span>
          </div>
          <p className="text-muted">Canada is charged in CAD. A United States listing is charged in USD.</p>
          <div className="flex items-baseline justify-between gap-6">
            <span>Active digital file</span>
            <span>C$1.49 / month</span>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <span>Valid new quote request</span>
            <span>{quoteRequest} each</span>
          </div>
          <p className="text-muted">Quote fees add up during the month and are included with the listing fee on the next bill. Twigigi does not charge the card for each quote. The same buyer is not charged again for the same request.</p>
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
          <p className="mt-4 text-sm text-muted">
            Card payments are securely processed by Stripe. Twigigi does not store your card number.
          </p>
          <button className={`${buttonClass} mt-6 w-full`}>Continue</button>
        </form>
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

export const metadata = { title: "Billing & Payment", robots: { index: false, follow: false } };
