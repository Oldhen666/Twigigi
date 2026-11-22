import { connection } from "next/server";
import { BillingMethodForm } from "@/components/billing-method-form";
import { ListingCharges } from "@/components/listing-charges";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { readPayoutSaved } from "@/lib/payments";
import { ReceivePayments } from "@/components/receive-payments";
import { buttonClass, ghostClass } from "@/components/ui";
import { payHeldCollection, payOpenFees } from "@/lib/actions";
import { formatListingFee, listingFeeCents, listingFeeCurrency, platformFee } from "@/lib/billing";
import { settlementView } from "@/lib/billing-calendar";
import { listingChargeView } from "@/lib/listing-charges";
import { cardCanRenew, BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { requireSeller } from "@/lib/auth";
import { subscriptionCovers } from "@/lib/digital-plans";
import { subscriptionCoversBuy } from "@/lib/buy-plans";
import { followupFeeLines, listAttentionCollections, listBillingListings, listSellerBills, markCardActionRequired, readBuySubscription, readDigitalSubscription, readQuoteTwigSettings, saveCardAuthorization, sellerProducts, setStripeAccount } from "@/lib/db";
import { FollowupFeeLines } from "@/components/followup-fee-lines";
import { previewQuoteListingCharge, QUOTE_FOLLOWUP_INCLUDED_LINE, QUOTE_FOLLOWUP_PUBLIC_LINE, QUOTE_LISTING_CENTS, quoteListingRateLine } from "@/lib/quote-followup";
import { collectSellerFees } from "@/lib/seller-fees";
import { outstandingCents } from "@/lib/fee-collection";
import { billingYear } from "@/lib/format";
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
  let autoPay = user.billingAutoPay;
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
      autoPay = true;
    } else if (verdict.status === "action_required") {
      markCardActionRequired(user.id, verdict.customerId);
      billingReady = false;
      authStatus = "action_required";
    } else {
      billingReady = false;
    }
  }
  const autoRenew = cardCanRenew({ method: billingMethod, ready: billingReady, authStatus, paymentMethodId, consentVersion });
  const settlement = await collectSellerFees({ ...user, billingReady, billingMethod, stripeCustomerId });
  const bills = listSellerBills(user.id);
  const billingListings = listBillingListings(user.id);
  const listings = billingListings.filter((product) => listingFeeCents(product.cta, product.feeExempt) > 0);
  const digitalCovered = subscriptionCovers(readDigitalSubscription(user.id));
  const buyCovered = subscriptionCoversBuy(readBuySubscription(user.id));
  const quoteRates = new Map(
    billingListings.filter((product) => product.cta === "quote").map((product) => [product.id, previewQuoteListingCharge(readQuoteTwigSettings(product.id))] as const),
  );
  const followups = followupFeeLines(user.id);
  const listingCharges = listingChargeView({
    listings: billingListings.map((product) => {
      const quoteRate = quoteRates.get(product.id);
      return {
        id: product.id,
        title: product.title,
        cta: product.cta,
        currency: quoteRate?.currency || product.billingCurrency || listingFeeCurrency(product.cta, product.location),
        feeExempt: product.feeExempt,
        paidUntil: product.paidUntil,
        anchorDay: product.anchorDay,
        status: product.status,
        billingStatus: product.billingStatus,
        listingCents: quoteRate?.cents,
      };
    }),
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
    coveredProductIds: [
      ...(digitalCovered ? billingListings.filter((product) => product.cta === "file").map((product) => product.id) : []),
      ...(buyCovered ? billingListings.filter((product) => product.cta === "buy").map((product) => product.id) : []),
    ],
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
            <BillingMethodForm saved={billingMethod} ready={billingReady} notice={billingNotice} autoRenew={autoRenew} autoPay={autoPay} cardBrand={cardBrand} cardLast4={cardLast4} />

            <details id="fee-details" className="group rounded-2xl border border-line bg-card px-4 py-4 sm:px-6 sm:py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest [&::-webkit-details-marker]:hidden">
                <span>Fee details</span>
                <span className="text-sm font-normal text-muted">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </summary>
              <div className="mt-4 min-w-0 space-y-8 border-t border-line pt-4 text-sm leading-6">
                <section>
                  <h3 className="font-serif text-xl">Listing subscriptions</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted">Next listing fee and the end of the current period. A Get a Quote listing shows its own price. Paid charges are not included.</p>
                  <ListingCharges currencies={listingCharges} />
                </section>
                <section className="border-t border-line pt-6">
                  <FollowupFeeLines lines={followups} />
                </section>
                <section className="border-t border-line pt-6">
                  <h3 className="text-sm font-medium text-muted">Rates</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted">These are the rates. A fee is due only after it is created. Canadian and US amounts stay separate. Digital files are always CAD.</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 rounded-xl border border-line px-4 py-3">
                      <p className="text-[13px] text-muted">Listing fee</p>
                      <p className="mt-1">New Get a Quote listing</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{quoteListingRateLine(QUOTE_LISTING_CENTS, "CAD")}</p>
                      <p className="mt-2">US physical Buy Now listings already on a listing fee</p>
                      <p className="font-sans text-[15px] font-semibold tabular-nums">{formatListingFee("USD")}</p>
                      <p className="mt-2 text-[13px] text-muted">A new Get a Quote publish uses this price. An existing published Get a Quote listing keeps its current price. Renewal stays on the 15th or the 28th already chosen for that listing. Buy Now bundles and Digital File plans are separate.</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-line px-4 py-3">
                      <p className="text-[13px] text-muted">Follow-up fee</p>
                      <p className="mt-1">{QUOTE_FOLLOWUP_PUBLIC_LINE}</p>
                      <p className="mt-2 text-[13px] text-muted">{QUOTE_FOLLOWUP_INCLUDED_LINE} The fee is added to the next billing statement. An existing unpaid follow-up fee stays on its bill.</p>
                    </div>
                  </div>
                </section>
                {outstandingByCurrency.length > 0 ? (
                  <section className="border-t border-line pt-6">
                    <h3 className="text-sm font-medium text-muted">Still unpaid</h3>
                    <ul className="mt-2 space-y-1">
                      {outstandingByCurrency.map((row) => (
                        <li key={row.currency} className="font-serif text-2xl">{platformFee(row.cents, row.currency)}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[13px] text-muted">This is the full unpaid total. A Twig card above shows only its next fee. Unpaid quotes stay here until a listing payment in the same currency includes them.</p>
                  </section>
                ) : null}
                {paymentHistory.length > 0 ? (
                  <section className="border-t border-line pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-muted">Payment history</h3>
                      <div className="flex flex-wrap gap-2">
                        {years.map((year) => (
                          <a key={year} href={`/dashboard/payments/receipts?year=${year}`} className={`${ghostClass} h-10 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest`}>
                            Download {year} statement
                          </a>
                        ))}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {paymentHistory.map((payment) => (
                        <li key={payment.id} className="rounded-xl border border-line px-4 py-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-[13px] text-muted">{chargeName(payment.paidAt)}</p>
                            <p className="font-sans text-[15px] font-semibold tabular-nums">{platformFee(payment.total, payment.currency)}</p>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {payment.lines.map((line) => (
                              <li key={line.id} className="flex items-baseline justify-between gap-3">
                                <p className="min-w-0 break-words font-medium">{line.title}</p>
                                <p className="shrink-0 text-[13px] text-muted">{line.kind === "quote" ? "Quote fee" : "Listing fee"} · {platformFee(line.amountCents, line.currency)}</p>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </section>
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
