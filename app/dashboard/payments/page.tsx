import { connection } from "next/server";
import { BillingMethodForm } from "@/components/billing-method-form";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { ReceivePayments } from "@/components/receive-payments";
import { ghostClass } from "@/components/ui";
import { requireSeller } from "@/lib/auth";
import { listSellerBills, setStripeAccount } from "@/lib/db";
import { billingYear, formatDate, formatMoney } from "@/lib/format";
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
  const stripeMessage = params.stripe === "setup" || params.stripe === "error" ? params.stripe : "";
  const country = user.payoutInterac || (!user.payoutVenmo && !user.payoutZelle) ? "CA" : "US";

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
            interac={user.payoutInterac}
            venmo={user.payoutVenmo}
            zelle={user.payoutZelle}
            initialCountry={country}
          />
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
