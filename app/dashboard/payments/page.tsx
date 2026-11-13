import { connection } from "next/server";
import { BillingMethodForm } from "@/components/billing-method-form";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { ReceivePayments } from "@/components/receive-payments";
import { buttonClass, ghostClass } from "@/components/ui";
import { payHeldCollection, payOpenFees } from "@/lib/actions";
import { formatListingFee, listingFeeCents, listingFeeCurrency, platformFee, QUOTE_SUBMISSION_CENTS } from "@/lib/billing";
import { cardCanRenew, BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { requireSeller } from "@/lib/auth";
import { listAttentionCollections, listBillingListings, listSellerBills, markCardActionRequired, saveCardAuthorization, sellerProducts, setStripeAccount } from "@/lib/db";
import { collectSellerFees } from "@/lib/seller-fees";
import { isOpenFee, outstandingCents } from "@/lib/fee-collection";
import { billingYear } from "@/lib/format";
import { autoChargeEnabled } from "@/lib/renewal-engine";
import { billingSetupCustomer, refreshStripeConnect } from "@/lib/stripe";

function chargeName(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function listingState(status: string) {
  if (status === "legacy_review") return "Not on automatic billing";
  if (status === "active") return "Active";
  if (status === "grace") return "Grace period";
  if (status === "paused") return "Paused";
  if (status === "canceled") return "Canceled";
  return "Not billed";
}

function billStatus(status: string) {
  if (status === "paid") return "Paid";
  if (status === "processing") return "Processing";
  if (isOpenFee(status)) return "Unpaid";
  if (status === "void") return "Not charged";
  return status;
}

function nextCharges(
  listings: Array<{ cta: string; location: string; feeExempt: boolean; autoRenew: boolean; nextRenewalAt: string; billingStatus: string }>,
  openQuotes: Array<{ currency: string; amountCents: number }>,
) {
  const groups = new Map<string, { nextIso: string; listingCents: number; quoteCents: number }>();
  for (const product of listings) {
    if (!product.autoRenew || !product.nextRenewalAt) continue;
    if (product.billingStatus === "legacy_review" || product.billingStatus === "canceled" || product.billingStatus === "paused") continue;
    const currency = listingFeeCurrency(product.cta, product.location);
    const fee = listingFeeCents(product.cta, product.feeExempt);
    const current = groups.get(currency);
    if (!current || product.nextRenewalAt < current.nextIso) {
      groups.set(currency, { nextIso: product.nextRenewalAt, listingCents: fee, quoteCents: 0 });
    } else if (product.nextRenewalAt === current.nextIso) {
      current.listingCents += fee;
    }
  }
  for (const bill of openQuotes) {
    const currency = bill.currency || "CAD";
    const current = groups.get(currency) || { nextIso: "", listingCents: 0, quoteCents: 0 };
    current.quoteCents += bill.amountCents;
    groups.set(currency, current);
  }
  return [...groups.entries()].map(([currency, row]) => ({
    currency,
    nextIso: row.nextIso,
    cents: row.nextIso ? row.listingCents + row.quoteCents : 0,
    quoteCents: row.quoteCents,
  }));
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
  const listings = listBillingListings(user.id).filter((product) => listingFeeCents(product.cta, product.feeExempt) > 0);
  const quoteBills = bills.filter((bill) => bill.kind === "quote");
  const openQuotes = quoteBills.filter((bill) => bill.status !== "paid" && bill.status !== "void");
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
      : params.billing === "stopped"
        ? "Automatic renewal is off. Time you already paid for stays in place."
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
  const saved = params.saved === "interac" || params.saved === "venmo" || params.saved === "zelle" ? params.saved : "";
  const charges = nextCharges(listings, openQuotes);
  const hasActivity = listings.length > 0 || bills.length > 0 || attention.length > 0 || settlement.open.length > 0;
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
            initialCountry={country}
            catalog={catalog}
            saved={saved}
          />
        }
        receipts={
          <div className="space-y-4">
            {hasActivity ? (
              <section className="rounded-3xl border border-line bg-card p-5">
                <h2 className="font-serif text-2xl">Next payment</h2>
                {charges.length === 0 ? <p className="mt-3 text-sm text-muted">No charge scheduled.</p> : (
                  <ul className="mt-3 space-y-2">
                    {charges.map((row) => (
                      <li key={row.currency} className="text-sm">
                        {row.nextIso ? (
                          <p><span className="font-serif text-3xl">{platformFee(row.cents, row.currency)}</span> <span className="text-muted">on {chargeName(row.nextIso)}</span></p>
                        ) : (
                          <p>{platformFee(row.quoteCents, row.currency)} in unpaid quotes. Added to the next listing payment in {row.currency}. Not charged alone.</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm text-muted">Canadian and US amounts stay separate.</p>
                <a href="#fee-details" className="mt-3 inline-block text-sm font-medium text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Fee details</a>
              </section>
            ) : (
              <section className="rounded-3xl border border-line bg-card px-5 py-4">
                <h2 className="font-serif text-2xl">Listing fees</h2>
                <ul className="mt-2 space-y-1 text-sm leading-6">
                  <li>Canadian listings and digital files: {formatListingFee("CAD")} per listing / 30 days</li>
                  <li>US physical listings: {formatListingFee("USD")} per listing / 30 days</li>
                  <li>A valid quote is {quoteCad} or {quoteUsd}. It is added to the next listing payment in the same currency and is not charged alone.</li>
                </ul>
              </section>
            )}

            {attention.map((row) => (
              <section key={row.id} className="rounded-3xl border border-line bg-card p-5">
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
            <BillingMethodForm saved={billingMethod} ready={billingReady} notice={billingNotice} autoRenew={autoRenew} cardLabel={cardLabel} chargesOn={chargesOn} />
            {listings.length === 0 && quoteBills.length === 0 && outstandingByCurrency.length === 0 && paymentHistory.length === 0 ? <p className="text-sm text-muted">No charges yet.</p> : null}

            <details id="fee-details" className="rounded-3xl border border-line bg-card px-5 py-4">
              <summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Fee details</summary>
              <div className="mt-4 space-y-4 border-t border-line pt-4 text-sm leading-6">
                <p className="text-muted">Canadian listings and digital files are {formatListingFee("CAD")} per listing / 30 days. US physical listings are {formatListingFee("USD")} per listing / 30 days. A valid quote is {quoteCad} or {quoteUsd}, added to the next listing payment in the same currency, and not charged alone. Canadian and US amounts stay separate.</p>
                {listings.length > 0 ? (
                  <div>
                    <h3 className="font-medium">Listings</h3>
                    <ul className="mt-2 divide-y divide-line">
                      {listings.map((product) => (
                        <li key={product.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                          <div>
                            <p className="font-medium">{product.title}</p>
                            <p className="text-muted">{listingState(product.billingStatus)} · {product.autoRenew ? "Auto-renew on" : "Auto-renew off"} · Paid until {chargeName(product.paidUntil)} · Next renewal {chargeName(product.nextRenewalAt)}</p>
                          </div>
                          <p className="font-serif text-lg">{platformFee(listingFeeCents(product.cta, product.feeExempt), listingFeeCurrency(product.cta, product.location))}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {quoteBills.length > 0 ? (
                  <div>
                    <h3 className="font-medium">Quotes</h3>
                    <ul className="mt-2 divide-y divide-line">
                      {quoteBills.map((bill) => (
                        <li key={bill.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                          <div>
                            <p className="font-medium">{bill.title}</p>
                            <p className="text-muted">{billStatus(bill.status)} · {chargeName(bill.createdAt)}</p>
                          </div>
                          <p className="font-serif text-lg">{platformFee(bill.amountCents, bill.currency)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
                          <p className="text-muted">{payment.lines.map((line) => `${line.kind === "quote" ? "Quote" : line.title} ${platformFee(line.amountCents, line.currency)}`).join(" · ")}</p>
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
