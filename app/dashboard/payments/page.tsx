import { connection } from "next/server";
import { BillingMethodForm } from "@/components/billing-method-form";
import { PaymentSettingsTabs } from "@/components/payment-settings-tabs";
import { ReceivePayments } from "@/components/receive-payments";
import { buttonClass, ghostClass } from "@/components/ui";
import { payHeldCollection, payOpenFees } from "@/lib/actions";
import { listingFeeCents, listingFeeCurrency, platformFee } from "@/lib/billing";
import { cardCanRenew, BILLING_CONSENT_VERSION } from "@/lib/billing-auth";
import { requireSeller } from "@/lib/auth";
import { listAttentionCollections, listBillingListings, listSellerBills, markCardActionRequired, saveCardAuthorization, setStripeAccount } from "@/lib/db";
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
  const nextIso = listings
    .filter((product) => product.autoRenew && product.nextRenewalAt && product.billingStatus !== "legacy_review" && product.billingStatus !== "canceled" && product.billingStatus !== "paused")
    .map((product) => product.nextRenewalAt)
    .sort()[0] || "";
  const nextListing = listings.find((product) => product.nextRenewalAt === nextIso);
  const estimateCurrency = nextListing ? listingFeeCurrency(nextListing.cta, nextListing.location) : "CAD";
  const estimateListingCents = listings.filter((product) => nextIso && product.nextRenewalAt === nextIso).length * listingFeeCents("buy");
  const estimateQuoteCents = openQuotes.filter((bill) => bill.currency === estimateCurrency).reduce((sum, bill) => sum + bill.amountCents, 0);
  const estimateCents = nextIso ? estimateListingCents + estimateQuoteCents : 0;
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
  const nextCharge = nextIso ? chargeName(nextIso) : "—";

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Payment settings</h1>
      <p className="mt-2 text-sm text-muted">From buyers is money buyers pay you. Fees to Twigigi is the card or PayPal you use to pay listing and quote fees.</p>
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
                <span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs font-medium">30-day cycles</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">Each listing is C$1.49 or USD$1.49 for its own 30 days. Quote fees stay unpaid until the next listing payment, and they are not charged on their own.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Estimated next payment</p>
                  <p className="mt-1 font-serif text-3xl">{nextIso ? platformFee(estimateCents, estimateCurrency) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Next renewal</p>
                  <p className="mt-1 font-serif text-3xl">{nextCharge}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Charged from</p>
                  <p className="mt-1 font-serif text-3xl">{autoRenew ? (cardLabel || "Card") : billingMethod === "paypal" && billingReady ? "PayPal, manual" : "Not connected"}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{chargesOn ? "Automatic card charges are on for sellers who saved a card and agreed. Each listing still renews on its own date." : "Automatic card charges are not turned on yet. Saving a card does not charge it until that switch is turned on."} The estimate includes the next listing renewal and unpaid quotes in that currency. Canadian and US amounts stay separate.</p>
            </section>

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
                <button className={buttonClass}>Pay {platformFee(settlement.open[0].dueCents, settlement.open[0].currency)} now</button>
              </form>
            ) : null}
            <BillingMethodForm saved={billingMethod} ready={billingReady} notice={billingNotice} autoRenew={autoRenew} cardLabel={cardLabel} />

            <section className="rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">Listing charges</h2>
              {listings.length === 0 ? <p className="mt-3 text-sm text-muted">No listing fee yet.</p> : (
                <ul className="mt-4 divide-y divide-line">
                  {listings.map((product) => (
                    <li key={product.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{product.title}</p>
                        <p className="text-muted">{listingState(product.billingStatus)} · {product.autoRenew ? "Auto-renew on" : "Auto-renew off"} · Paid until {chargeName(product.paidUntil)} · Next renewal {chargeName(product.nextRenewalAt)}</p>
                      </div>
                      <p className="font-serif text-lg">{platformFee(listingFeeCents(product.cta), listingFeeCurrency(product.cta, product.location))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">Quote charges</h2>
              {quoteBills.length === 0 ? <p className="mt-3 text-sm text-muted">No quote fee yet.</p> : (
                <ul className="mt-4 divide-y divide-line">
                  {quoteBills.map((bill) => (
                    <li key={bill.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{bill.title}</p>
                        <p className="text-muted">{billStatus(bill.status)} · {chargeName(bill.createdAt)}</p>
                      </div>
                      <p className="font-serif text-lg">{platformFee(bill.amountCents, bill.currency)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">Outstanding balance</h2>
              {outstandingByCurrency.length === 0 ? <p className="mt-3 font-serif text-3xl">C$0.00</p> : (
                <ul className="mt-3 space-y-1">
                  {outstandingByCurrency.map((row) => (
                    <li key={row.currency} className="font-serif text-3xl">{platformFee(row.cents, row.currency)}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm leading-6 text-muted">Unpaid quotes stay here until a listing payment in the same currency includes them. A quote balance is not charged by itself, and Canadian and US balances are not combined.</p>
            </section>

            <section className="rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl">Payment history</h2>
                <div className="flex flex-wrap gap-2">
                  {years.map((year) => (
                    <a key={year} href={`/dashboard/payments/receipts?year=${year}`} className={`${ghostClass} h-10 px-4 text-sm`}>
                      Download {year} statement
                    </a>
                  ))}
                </div>
              </div>
              {paymentHistory.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No payment yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {paymentHistory.map((payment) => (
                    <li key={payment.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <p className="font-medium">{chargeName(payment.paidAt)}</p>
                        <p className="font-serif text-lg">{platformFee(payment.total, payment.currency)}</p>
                      </div>
                      <p className="text-muted">{payment.lines.map((line) => `${line.kind === "quote" ? "Quote" : line.title} ${platformFee(line.amountCents, line.currency)}`).join(" · ")}</p>
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
