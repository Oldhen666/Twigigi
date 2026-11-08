import Link from "next/link";
import { connection } from "next/server";
import { BillingMethodForm } from "@/components/billing-method-form";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { ReceivePayments } from "@/components/receive-payments";
import { ghostClass } from "@/components/ui";
import { billingCurrency, listingFeeCents, listingFeeCurrency, MINIMUM_BILL_CENTS, periodCharge, platformFee, QUOTE_CARRY_MONTHS, QUOTE_SUBMISSION_CENTS } from "@/lib/billing";
import { requireSeller } from "@/lib/auth";
import { listBillingListings, listSellerBills, quotePeriodCounts, setBillingAuthorization, setStripeAccount } from "@/lib/db";
import { billingYear, nextBillingDate, periodStart } from "@/lib/format";
import { billingSetupCustomer, refreshStripeConnect } from "@/lib/stripe";

function periodName(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Edmonton", month: "short", year: "numeric" }).format(new Date(iso));
}

function chargeName(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Edmonton", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function billStatus(status: string) {
  if (status === "paid") return "Paid";
  if (status === "recorded") return "Billed";
  return status;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const user = await requireSeller();
  let stripeReady = user.stripeChargesEnabled;
  if (user.stripeAccountId && (params.stripe === "return" || params.stripe === "refresh" || !stripeReady)) {
    const refreshed = await refreshStripeConnect(user.stripeAccountId);
    if (refreshed) {
      setStripeAccount(user.id, refreshed.id, refreshed.chargesEnabled);
      stripeReady = refreshed.chargesEnabled;
    }
  }
  let billingReady = user.billingReady;
  let billingMethod = user.billingMethod;
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  if (params.billing === "return" && sessionId) {
    const customerId = await billingSetupCustomer(sessionId, user.id);
    if (customerId) {
      setBillingAuthorization(user.id, { method: "card", ready: true, stripeCustomerId: customerId });
      billingReady = true;
      billingMethod = "card";
    }
  }
  const bills = listSellerBills(user.id);
  const accrued = bills.filter((bill) => bill.kind === "quote" && bill.status === "accrued");
  const receipts = bills.filter((bill) => !(bill.kind === "quote" && bill.status === "accrued"));
  const listings = listBillingListings(user.id).filter((product) => listingFeeCents(product.cta, product.feeExempt) > 0);
  const quotes = quotePeriodCounts(user.id, periodStart());
  const currencies = new Set<string>(["CAD"]);
  for (const product of listings) currencies.add(listingFeeCurrency(product.cta, product.location));
  for (const bill of accrued) currencies.add(bill.currency);
  for (const quote of quotes) currencies.add(billingCurrency(quote.location));
  const groups = [...currencies].map((currency) => {
    const currencyListings = listings.filter((product) => listingFeeCurrency(product.cta, product.location) === currency);
    const currencyQuotes = accrued.filter((bill) => bill.currency === currency);
    const periodQuotes = quotes.filter((quote) => billingCurrency(quote.location) === currency);
    const listingCents = currencyListings.length * listingFeeCents("buy");
    const quoteCents = currencyQuotes.reduce((sum, bill) => sum + bill.amountCents, 0);
    const oldest = currencyQuotes.reduce((found, bill) => (!found || bill.createdAt < found ? bill.createdAt : found), "");
    const charge = periodCharge({ listingCents, quoteCents, oldestQuoteAt: oldest || null });
    const digital = currencyListings.length > 0 && currencyListings.every((product) => product.cta === "file");
    const listingLabel = currencyListings.length === 1
      ? digital ? "Digital listing subscription" : "Listing subscription"
      : `${digital ? "Digital listing subscriptions" : "Listing subscriptions"} (${currencyListings.length} × ${platformFee(listingFeeCents("buy"), currency)})`;
    return {
      currency,
      listingCount: currencyListings.length,
      listingCents,
      listingLabel,
      quoteCount: currencyQuotes.length,
      quoteCents,
      received: periodQuotes.reduce((sum, quote) => sum + quote.count, 0),
      billable: periodQuotes.filter((quote) => quote.billable).reduce((sum, quote) => sum + quote.count, 0),
      waived: periodQuotes.filter((quote) => !quote.billable).reduce((sum, quote) => sum + quote.count, 0),
      dueCents: charge.dueCents,
      carriedCents: charge.carriedCents,
    };
  }).filter((group) => group.listingCount > 0 || group.quoteCount > 0 || group.received > 0);
  const shown = groups.length > 0 ? groups : [{
    currency: "CAD",
    listingCount: 0,
    listingCents: 0,
    listingLabel: "Listing subscription",
    quoteCount: 0,
    quoteCents: 0,
    received: 0,
    billable: 0,
    waived: 0,
    dueCents: 0,
    carriedCents: 0,
  }];
  const due = shown.reduce((sum, group) => sum + group.dueCents, 0);
  const carried = shown.reduce((sum, group) => sum + group.carriedCents, 0);
  const years = [...new Set(receipts.map((bill) => billingYear(bill.createdAt)).filter(Boolean))];
  const currentYear = billingYear(new Date().toISOString());
  if (currentYear && !years.includes(currentYear)) years.unshift(currentYear);
  years.sort((left, right) => Number(right) - Number(left));
  const initial = params.tab === "receipts" ? "receipts" : "receiving";
  const stripeMessage = params.stripe === "setup" || params.stripe === "error" ? params.stripe : "";
  const stripeReason = params.stripe === "error" && typeof params.reason === "string" ? params.reason.slice(0, 180) : "";
  const reason = typeof params.reason === "string" ? params.reason.slice(0, 180) : "";
  const billingNotice = params.billing === "setup"
    ? "Stripe is not set up on this server yet."
    : params.billing === "canceled"
      ? "Setup was canceled. Nothing was connected."
      : params.billing === "paypal"
        ? reason || "PayPal did not finish the billing agreement. This method is not connected."
        : params.billing === "error"
          ? reason || "Card setup could not start."
          : "";
  const country = user.payoutInterac || (!user.payoutVenmo && !user.payoutZelle) ? "CA" : "US";
  const nextCharge = chargeName(nextBillingDate());

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Payment settings</h1>
      <p className="mt-2 text-sm text-muted">Manage how you receive payments from buyers and pay Twigigi fees.</p>
      <PaymentSettingsTabs
        initial={initial}
        receiving={
          <ReceivePayments
            stripeReady={stripeReady}
            stripeStarted={Boolean(user.stripeAccountId)}
            stripeMessage={stripeMessage}
            stripeReason={stripeReason}
            interac={user.payoutInterac}
            venmo={user.payoutVenmo}
            zelle={user.payoutZelle}
            initialCountry={country}
          />
        }
        receipts={
          <div className="space-y-4">
            <section className="rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-serif text-2xl">Billing overview</h2>
                <span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs font-medium">{periodName(periodStart())}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">What you owe Twigigi, when it is charged, and which method can be charged.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">On the next bill</p>
                  <p className="mt-1 font-serif text-3xl">{shown.map((group) => platformFee(group.dueCents, group.currency)).join(" · ")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Next billing date</p>
                  <p className="mt-1 font-serif text-3xl">{nextCharge}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Payment method</p>
                  <p className="mt-1 font-serif text-3xl">{billingReady ? (billingMethod === "paypal" ? "PayPal" : "Card") : "Not connected"}</p>
                </div>
              </div>
              {carried > 0 ? (
                <p className="mt-4 text-sm leading-6">
                  Quote fees carried forward: {shown.filter((group) => group.carriedCents > 0).map((group) => platformFee(group.carriedCents, group.currency)).join(" · ")}.
                  A quote-only balance under {platformFee(MINIMUM_BILL_CENTS, "CAD")} is not charged by itself.
                </p>
              ) : due === 0 ? <p className="mt-4 text-sm text-muted">Nothing is due on the next bill.</p> : null}
              <p className="mt-3 text-sm leading-6 text-muted">
                Listing fees and quote fees are billed together and shown as separate lines. Quote fees under {platformFee(MINIMUM_BILL_CENTS, "CAD")} with no listing fee wait until a listing fee is included, the balance reaches that amount, or they have been carried for {QUOTE_CARRY_MONTHS} billing periods. Closing the account settles any remaining balance. Tax is calculated when the bill is charged.
              </p>
            </section>

            <BillingMethodForm saved={billingMethod} ready={billingReady} notice={billingNotice} />

            {shown.map((group) => (
              <section key={group.currency} className="rounded-3xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-serif text-2xl">Usage this period</h2>
                  <span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs font-medium">{periodName(periodStart())} · {group.currency}</span>
                </div>
                <dl className="mt-4 divide-y divide-line text-sm">
                  <div className="flex justify-between gap-3 py-2"><dt>Active paid listings</dt><dd>{group.listingCount}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt>Quote requests received</dt><dd>{group.received}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt>Billable requests</dt><dd>{group.billable}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt>Waived or duplicate requests</dt><dd>{group.waived}</dd></div>
                </dl>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr><th className="py-2 font-medium">Description</th><th className="py-2 text-right font-medium">Amount</th></tr>
                    </thead>
                    <tbody>
                      {group.listingCents > 0 ? (
                        <tr className="border-t border-line"><td className="py-2">{group.listingLabel}</td><td className="py-2 text-right">{platformFee(group.listingCents, group.currency)}</td></tr>
                      ) : null}
                      {group.quoteCents > 0 ? (
                        <tr className="border-t border-line"><td className="py-2">Quote requests ({group.quoteCount} × {platformFee(QUOTE_SUBMISSION_CENTS, group.currency)})</td><td className="py-2 text-right">{platformFee(group.quoteCents, group.currency)}</td></tr>
                      ) : null}
                      <tr className="border-t border-line"><td className="py-2">Subtotal</td><td className="py-2 text-right">{platformFee(group.dueCents || group.carriedCents, group.currency)}</td></tr>
                      {group.carriedCents > 0 ? (
                        <tr className="border-t border-line"><td className="py-2">Charged this period</td><td className="py-2 text-right">Carried forward</td></tr>
                      ) : (
                        <>
                          <tr className="border-t border-line"><td className="py-2">Tax, if applicable</td><td className="py-2 text-right">Calculated when charged</td></tr>
                          <tr className="border-t border-line font-medium"><td className="py-2">On the next bill</td><td className="py-2 text-right">{platformFee(group.dueCents, group.currency)} + tax</td></tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">Deactivating a listing stops future listing charges according to your billing terms. It does not refund the current period. Quote fees already incurred remain payable.</p>
                <Link href="/dashboard/quotes" className="mt-3 inline-block text-sm font-medium text-forest">View quote activity</Link>
              </section>
            ))}

            <section className="rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl">Billing history</h2>
                <div className="flex flex-wrap gap-2">
                  {years.map((year) => (
                    <a key={year} href={`/dashboard/payments/receipts?year=${year}`} className={`${ghostClass} h-10 px-4 text-sm`}>
                      Download {year} statement
                    </a>
                  ))}
                </div>
              </div>
              {receipts.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No bill yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {receipts.map((bill) => (
                    <li key={`${bill.createdAt}-${bill.title}-${bill.kind}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{bill.title}</p>
                        <p className="text-muted">{bill.kind === "quote" ? "Quote request" : "Listing"} · {billStatus(bill.status)} · {chargeName(bill.createdAt)}</p>
                      </div>
                      <p className="font-serif text-lg">{platformFee(bill.amountCents, bill.currency)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        }
      />
    </main>
  );
}

export const metadata = { title: "Payment settings", robots: { index: false, follow: false } };
