import { connection } from "next/server";
import { BillingMethodForm } from "@/components/billing-method-form";
import { ListingCharges } from "@/components/listing-charges";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { readPayoutSaved } from "@/lib/payments";
import { ReceivePayments } from "@/components/receive-payments";
import { buttonClass, ghostClass } from "@/components/ui";
import { payHeldCollection, payOpenFees } from "@/lib/actions";
import { formatListingFee, listingFeeCents, listingFeeCurrency, platformFee, QUOTE_SUBMISSION_CENTS } from "@/lib/billing";
import { settlementView } from "@/lib/billing-calendar";
import { listingChargeView } from "@/lib/listing-charges";
import { cardCanRenew, BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { requireSeller } from "@/lib/auth";
import { listAttentionCollections, listBillingListings, listSellerBills, markCardActionRequired, saveCardAuthorization, sellerProducts, setStripeAccount } from "@/lib/db";
import { collectSellerFees } from "@/lib/seller-fees";
import { outstandingCents } from "@/lib/fee-collection";
import { billingYear } from "@/lib/format";
import { autoChargeEnabled } from "@/lib/renewal-engine";
import { billingSetupCustomer, refreshStripeConnect } from "@/lib/stripe";

function chargeName(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
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
  let stripeCustomerId = user.stripeCustomerId;
  let authStatus = user.billingAuthStatus;
  let cardBrand = user.billingCardBrand;
  let cardLast4 = user.billingCardLast4;
  let consentVersion = user.billingConsentVersion;
  let paymentMethodId = user.billingPmId;
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  if (params.billing === "return" && sessionId) {
    const verdict = await billingSetupCustomer(sessionId, user.id);
    if (verdict.status === "authorized" && saveCardAuthorization(user.id, {
      customerId: verdict.customerId,
      paymentMethodId: verdict.paymentMethodId,
      brand: verdict.brand,
      last4: verdict.last4,
      consentVersion: BILLING_CONSENT_VERSION,
    })) {
      billingReady = true;
      billingMethod = "card";
      stripeCustomerId = verdict.customerId;
      authStatus = "authorized";
      cardBrand = verdict.brand;
      cardLast4 = verdict.last4;
      consentVersion = BILLING_CONSENT_VERSION;
      paymentMethodId = verdict.paymentMethodId;
    } else if (verdict.status === "action_required") {
      markCardActionRequired(user.id, verdict.customerId);
      billingReady = false;
      authStatus = "action_required";
    } else {
      billingReady = false;
    }
  }
  const autoRenew = cardCanRenew({ method: billingMethod, ready: billingReady, authStatus, paymentMethodId, consentVersion });
  const cardLabel = cardBrand && cardLast4 ? `${cardBrand} ···· ${cardLast4}` : "";
  const chargesOn = autoChargeEnabled();
  const settlement = await collectSellerFees({ ...user, billingReady, billingMethod, stripeCustomerId });
  const bills = listSellerBills(user.id);
  const billingListings = listBillingListings(user.id);
  const listings = billingListings.filter((product) => listingFeeCents(product.cta, product.feeExempt) > 0);
  const listingCharges = listingChargeView({
    listings: billingListings.map((product) => ({
      id: product.id,
      title: product.title,
      currency: product.billingCurrency || listingFeeCurrency(product.cta, product.location),
      feeExempt: product.feeExempt,
      paidUntil: product.paidUntil,
      anchorDay: product.anchorDay,
      status: product.status,
      billingStatus: product.billingStatus,
    })),
    bills: bills.map((bill) => ({
      productId: bill.productId,
      title: bill.title,
      kind: bill.kind,
      currency: bill.currency,
      amountCents: bill.amountCents,
      status: bill.status,
      dueAt: bill.dueAt,
      periodKey: bill.billingPeriodKey,
    })),
  });
  const outstandingByCurrency = [...new Set(bills.map((bill) => bill.currency || "CAD"))]
    .map((currency) => ({ currency, cents: outstandingCents(bills, currency) }))
    .filter((row) => row.cents > 0);
  const payments = new Map<string, { id: string; currency: string; total: number; paidAt: string; lines: typeof bills }>();
  for (const bill of bills.filter((item) => item.status === "paid")) {
    const id = bill.collectionId || bill.id;
    const current = payments.get(id) || { id, currency: bill.currency, total: 0, paidAt: bill.paidAt || bill.createdAt, lines: [] };
    current.total += bill.amountCents;
    current.lines.push(bill);
    payments.set(id, current);
  }
  const paymentHistory = [...payments.values()];
  const years = [...new Set(paymentHistory.map((payment) => billingYear(payment.paidAt)).filter(Boolean))];
  const currentYear = billingYear(new Date().toISOString());
  if (currentYear && !years.includes(currentYear)) years.unshift(currentYear);
  years.sort((left, right) => Number(right) - Number(left));
  const initial = params.tab === "receipts" ? "receipts" : "receiving";
  const stripeMessage = params.stripe === "setup" || params.stripe === "error" ? params.stripe : "";
  const stripeReason = params.stripe === "error" && typeof params.reason === "string" ? params.reason.slice(0, 180) : "";
  const reason = typeof params.reason === "string" ? params.reason.slice(0, 180) : "";
  const attention = listAttentionCollections(user.id);
  const billingNotice = params.billing === "setup"
    ? "Stripe is not set up on this server yet."
    : params.billing === "canceled"
      ? "Setup was canceled. Nothing was connected."
        : params.billing === "stopped" || params.billing === "manual"
        ? "Automatic payment is off. Unpaid fees still need to be paid."
        : params.billing === "pending"
          ? "A payment is still being confirmed. Twigigi will not start a second charge for it."
          : params.billing === "return" && !autoRenew
            ? "The card was not saved for automatic renewal."
          : params.billing === "paypal"
        ? reason || "PayPal did not finish the billing agreement. This method is not connected."
        : params.billing === "error"
          ? reason || "Card setup could not start."
          : "";
  const country = user.payoutInterac || (!user.payoutVenmo && !user.payoutZelle) ? "CA" : "US";
  const products = sellerProducts(user.id);
  const catalog = {
    hasProducts: products.length > 0,
    hasFile: products.some((product) => product.cta === "file"),
    hasBuy: products.some((product) => product.cta === "buy"),
    hasQuote: products.some((product) => product.cta === "quote"),
  };
  const saved = readPayoutSaved(typeof params.saved === "string" ? params.saved : undefined);
  const preview = settlementView({
    products: listings.map((product) => ({
      currency: product.billingCurrency || listingFeeCurrency(product.cta, product.location),
      anchorDay: product.anchorDay,
      paidUntil: product.paidUntil,
      status: product.status,
      billingStatus: product.billingStatus,
    })),
    bills: bills.map((bill) => ({
      currency: bill.currency,
      amountCents: bill.amountCents,
      status: bill.status,
      dueAt: bill.dueAt,
    })),
  });
  const quoteCad = platformFee(QUOTE_SUBMISSION_CENTS, "CAD");
  const quoteUsd = platformFee(QUOTE_SUBMISSION_CENTS, "USD");

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Payments</h1>
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
            paypalMe={user.payoutPaypalMe}
            paypalEmail={user.payoutPaypalEmail}
            initialCountry={country}
            catalog={catalog}
            saved={saved}
          />
        }
        receipts={
          <div className="min-w-0 space-y-4 overflow-x-clip">
            <section className="rounded-2xl border border-line bg-card px-4 py-4 sm:px-6 sm:py-6">
              <h2 className="font-serif text-2xl">Billing overview</h2>
              {(() => {
                const balances = (["CAD", "USD"] as const).map((currency) => preview.find((row) => row.currency === currency) || { currency, balanceCents: 0, batches: [] });
                const batches = balances.flatMap((row) => row.batches).sort((left, right) => left.date.localeCompare(right.date));
                const nextDate = batches[0];
                const later = batches.slice(1);
                return (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[15px]">Next billing date</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{nextDate ? nextDate.label : "Not scheduled"}</p>
                    </div>
                    {nextDate ? null : <p className="mt-1 text-[13px] leading-5 text-muted">Billing date is set when you publish your first paid Twig.</p>}
                    {later.length > 0 ? <p className="mt-1 text-[13px] leading-5 text-muted">Later billing date {later.map((batch) => batch.label).join(", ")}</p> : null}
                    <div className="mt-3 divide-y divide-line">
                      {balances.map((row) => (
                        <a key={row.currency} href={`/dashboard/payments/balance?currency=${row.currency}`} className="flex items-center justify-between gap-3 py-2.5 text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                          <span>{row.currency} balance</span>
                          <span className="inline-flex items-center gap-1 font-sans font-semibold tabular-nums">
                            {platformFee(row.balanceCents, row.currency)}
                            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 text-muted">
                              <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>

            {attention.map((row) => (
              <section key={row.id} className="rounded-2xl border border-line bg-card px-4 py-4 sm:px-6 sm:py-6">
                <h2 className="font-serif text-2xl">{row.status === "unknown" ? "Payment still confirming" : "Bank verification needed"}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{platformFee(row.amountCents, row.currency)} is already attached to one payment. Twigigi will not create a second charge while this one is open.</p>
                {row.status === "action_required" ? (
                  <form action={payHeldCollection} className="mt-4">
                    <input type="hidden" name="id" value={row.id} />
                    <button className={buttonClass}>Verify or pay another way</button>
                  </form>
                ) : null}
              </section>
            ))}
            {settlement.open.length > 0 ? (
              <form action={payOpenFees}>
                <button className={`${buttonClass} w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:w-fit`}>Pay {platformFee(settlement.open[0].dueCents, settlement.open[0].currency)} now</button>
              </form>
            ) : null}
            <BillingMethodForm saved={billingMethod} ready={billingReady} notice={billingNotice} autoRenew={autoRenew} autoPay={user.billingAutoPay} cardLabel={cardLabel} chargesOn={chargesOn} />

            <details id="fee-details" className="group rounded-2xl border border-line bg-card px-4 py-4 sm:px-6 sm:py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
                <span>Fee details</span>
                <span className="text-sm font-normal text-muted">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </summary>
              <div className="mt-3 min-w-0 space-y-4 border-t border-line pt-3 text-sm leading-6">
                <div>
                  <h3 className="font-medium">Listing fee rate</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted">This is the rate for a listing period. It is not the amount due until a fee is created.</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p>Canadian listings and digital files</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{formatListingFee("CAD")}</p>
                      <p className="text-muted">CAD</p>
                      <p className="text-muted">First charge at paid publish</p>
                      <p className="text-muted">Then the 15th or the 28th</p>
                    </div>
                    <div className="min-w-0">
                      <p>US physical listings</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{formatListingFee("USD")}</p>
                      <p className="text-muted">USD</p>
                      <p className="text-muted">First charge at paid publish</p>
                      <p className="text-muted">Then the 15th or the 28th</p>
                    </div>
                  </div>
                  <ListingCharges currencies={listingCharges} />
                </div>
                <div>
                  <h3 className="font-medium">Quote fee rate</h3>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p>Valid quote on a Canadian listing or digital file</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{quoteCad}</p>
                      <p className="text-muted">CAD</p>
                      <p className="text-muted">Each valid request</p>
                    </div>
                    <div className="min-w-0">
                      <p>Valid quote on a US listing</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{quoteUsd}</p>
                      <p className="text-muted">USD</p>
                      <p className="text-muted">Each valid request</p>
                    </div>
                  </div>
                  <p className="mt-2 max-w-prose text-muted">Added to the next listing payment in the same currency. Not charged alone.</p>
                </div>
                <div>
                  <h3 className="font-medium">Currencies</h3>
                  <p className="mt-2 max-w-prose">Canadian and US amounts stay separate.</p>
                  <p className="max-w-prose text-muted">Digital files are always CAD. Quotes use the listing currency and are not converted.</p>
                </div>
                {outstandingByCurrency.length > 0 ? (
                  <div>
                    <h3 className="font-medium">Outstanding</h3>
                    <ul className="mt-2 space-y-1">
                      {outstandingByCurrency.map((row) => (
                        <li key={row.currency} className="font-serif text-lg">{platformFee(row.cents, row.currency)}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-muted">Unpaid quotes stay here until a listing payment in the same currency includes them.</p>
                  </div>
                ) : null}
                {paymentHistory.length > 0 ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-medium">Payment history</h3>
                      <div className="flex flex-wrap gap-2">
                        {years.map((year) => (
                          <a key={year} href={`/dashboard/payments/receipts?year=${year}`} className={`${ghostClass} h-10 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}>
                            Download {year} statement
                          </a>
                        ))}
                      </div>
                    </div>
                    <ul className="mt-2 divide-y divide-line">
                      {paymentHistory.map((payment) => (
                        <li key={payment.id} className="py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <p className="font-medium">{chargeName(payment.paidAt)}</p>
                            <p className="font-serif text-lg">{platformFee(payment.total, payment.currency)}</p>
                          </div>
                          <p className="break-words text-muted">{payment.lines.map((line) => `${line.kind === "quote" ? "Quote" : line.title} ${platformFee(line.amountCents, line.currency)}`).join(" · ")}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          </div>
        }
      />
    </main>
  );
}

export const metadata = { title: "Payments", robots: { index: false, follow: false } };
