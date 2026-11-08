import { connection } from "next/server";
import { savePayoutDetails, startStripeConnect } from "@/lib/actions";
import { BillingMethodForm } from "@/components/billing-method-form";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { buttonClass, ghostClass, inputClass, labelClass } from "@/components/ui";
import { requireSeller } from "@/lib/auth";
import { listSellerBills, setStripeAccount } from "@/lib/db";
import { billingYear, formatDate, formatMoney } from "@/lib/format";
import { SELLER_PAYMENT_RESPONSIBILITY } from "@/lib/legal";
import { refreshStripeConnect } from "@/lib/stripe";

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
  const bills = listSellerBills(user.id);
  const accrued = bills.filter((bill) => bill.kind === "quote" && bill.status === "accrued");
  const receipts = bills.filter((bill) => !(bill.kind === "quote" && bill.status === "accrued"));
  const accruedTotals = new Map<string, number>();
  for (const bill of accrued) accruedTotals.set(bill.currency, (accruedTotals.get(bill.currency) ?? 0) + bill.amountCents);
  const years = [...new Set(receipts.map((bill) => billingYear(bill.createdAt)).filter(Boolean))];
  const currentYear = billingYear(new Date().toISOString());
  if (currentYear && !years.includes(currentYear)) years.unshift(currentYear);
  years.sort((left, right) => Number(right) - Number(left));
  const initial = params.tab === "receipts" ? "receipts" : "receiving";

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Payment settings</h1>
      <p className="mt-2 text-sm text-muted">Where buyers pay you, and the receipts for Twigigi fees.</p>
      <PaymentSettingsTabs
        initial={initial}
        receiving={
          <section className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-serif text-2xl">Card payments for digital files</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {stripeReady
                ? "Stripe is connected. Buyers can pay by card, and the money goes to your Stripe account. Twigigi does not take a fee."
                : "Connect Stripe so buyers can pay by card. The money goes to your Stripe account. Twigigi does not take a fee."}
            </p>
            {params.stripe === "setup" ? <p className="mt-3 text-sm text-clay">Stripe is not set up on this server yet.</p> : null}
            {params.stripe === "error" ? <p className="mt-3 text-sm text-clay">Stripe could not open the connection page.</p> : null}
            {stripeReady ? null : (
              <form action={startStripeConnect} className="mt-4 grid gap-4">
                {user.stripeAccountId ? null : (
                  <label>
                    <span className={labelClass}>Country</span>
                    <select name="country" defaultValue="CA" className={inputClass}>
                      <option value="CA">Canada</option>
                      <option value="US">United States</option>
                    </select>
                  </label>
                )}
                <button className={`${buttonClass} w-fit`}>{user.stripeAccountId ? "Continue Stripe setup" : "Connect Stripe"}</button>
              </form>
            )}
            <p className="mt-5 text-sm text-muted">Where buyers can pay you for other Twigs. These are not the card Twigigi charges.</p>
            <form action={savePayoutDetails} className="mt-4 grid gap-4" noValidate>
              <label>
                <span className={labelClass}>Interac e-Transfer email</span>
                <input name="interac" defaultValue={user.payoutInterac} className={inputClass} autoComplete="email" />
              </label>
              <label>
                <span className={labelClass}>Venmo username</span>
                <input name="venmo" defaultValue={user.payoutVenmo} className={inputClass} />
              </label>
              <button className={`${buttonClass} w-fit`}>Save receiving details</button>
            </form>
            <div className="mt-5 space-y-3 border-t border-line pt-5 text-sm leading-6 text-muted">
              <h2 className="font-medium text-ink">Seller responsibility for payment information</h2>
              {SELLER_PAYMENT_RESPONSIBILITY.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        }
        receipts={
          <>
            <BillingMethodForm saved={user.billingMethod} />
            <section className="mt-6 rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">Quote fees this period</h2>
              <p className="mt-2 text-sm leading-6 text-muted">These add up during the month and go on your next Twigigi bill with the listing fee. Twigigi does not charge the card for each quote. If you deactivate a Twig, fees already counted stay on that next bill.</p>
              {accrued.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No quote fee is waiting.</p>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium">
                    {[...accruedTotals.entries()].map(([currency, cents]) => `${formatMoney(cents, currency)} ${currency}`).join(" · ")}
                  </p>
                  <ul className="mt-3 divide-y divide-line">
                    {accrued.map((bill) => (
                      <li key={`${bill.createdAt}-${bill.title}-${bill.amountCents}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                        <div>
                          <p className="font-medium">{bill.title}</p>
                          <p className="text-muted">Quote request · on the next bill · {formatDate(bill.createdAt)}</p>
                        </div>
                        <p className="font-serif text-lg">{formatMoney(bill.amountCents, bill.currency)} {bill.currency}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className="mt-6 rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl">Receipts</h2>
                <div className="flex flex-wrap gap-2">
                  {years.map((year) => (
                    <a key={year} href={`/dashboard/payments/receipts?year=${year}`} className={`${ghostClass} h-10 px-4 text-sm`}>
                      Download {year} PDF
                    </a>
                  ))}
                </div>
              </div>
              {receipts.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No receipt yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {receipts.map((bill) => (
                    <li key={`${bill.createdAt}-${bill.title}-${bill.kind}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{bill.title}</p>
                        <p className="text-muted">
                          {bill.kind === "quote" ? "Quote request" : "Listing"} · {bill.status} · {formatDate(bill.createdAt)}
                        </p>
                      </div>
                      <p className="font-serif text-lg">{formatMoney(bill.amountCents, bill.currency)} {bill.currency}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        }
      />
    </main>
  );
}

export const metadata = { title: "Payment settings", robots: { index: false, follow: false } };
