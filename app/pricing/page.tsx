import Link from "next/link";
import { LISTING_CENTS, platformFee } from "@/lib/billing";
import { BUY_PLANS } from "@/lib/buy-plans";
import { coveringDigitalQuotes, digitalMonthlyTotal, DIGITAL_PLANS, formatFeeRate, listingLimitLabel } from "@/lib/digital-plans";
import { QUOTE_FOLLOWUP_INCLUDED_LINE, QUOTE_FOLLOWUP_PUBLIC_LINE, QUOTE_LISTING_PUBLIC_LINE, quoteFeeExample } from "@/lib/quote-followup";

export const metadata = { title: "Pricing" };

const EXAMPLE_LISTINGS = 18;
const EXAMPLE_SALES_CENTS = 150_000;

export default function Page() {
  const digitalExample = coveringDigitalQuotes(EXAMPLE_LISTINGS);
  const creatorPlan = DIGITAL_PLANS.find((plan) => plan.id === "creator");
  const growthPlan = DIGITAL_PLANS.find((plan) => plan.id === "growth");
  const creator = digitalExample.find((quote) => quote.plan.id === "creator");
  const growth = digitalExample.find((quote) => quote.plan.id === "growth");
  const creatorTotal = creator ? digitalMonthlyTotal(creator, EXAMPLE_SALES_CENTS) : 0;
  const growthTotal = growth ? digitalMonthlyTotal(growth, EXAMPLE_SALES_CENTS) : 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="font-serif text-4xl">Pricing</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Prices below are what Twigigi charges the seller. Buyer checkout stays with the seller. Examples are not a quote for your shop.</p>

      <section className="mt-8">
        <h2 className="font-serif text-3xl">Get a Quote</h2>
        <p className="mt-3 text-sm leading-6">{QUOTE_LISTING_PUBLIC_LINE}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6">{QUOTE_FOLLOWUP_PUBLIC_LINE}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6">{QUOTE_FOLLOWUP_INCLUDED_LINE}</p>
        <p className="mt-3 max-w-2xl text-sm leading-6">{quoteFeeExample()}</p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Buy Now</h2>
        <p className="mt-3 text-sm leading-6">One published listing: {platformFee(LISTING_CENTS, "CAD")} every 30 days. A bundle is optional and renews monthly. Drafts do not use a slot.</p>
        <div className="mt-4 max-w-xl rounded-xl border border-line bg-card p-2">
          {BUY_PLANS.map((plan, index) => (
            <div key={plan.id} className={`flex items-center justify-between gap-3 px-3 py-3 ${index > 0 ? "border-t border-line" : ""}`}>
              <span>
                <span className="block text-sm font-medium">{plan.listings == null ? "Unlimited listings" : `${plan.listings} listings`}</span>
                <span className="mt-0.5 block text-xs text-muted">{plan.listings == null ? "No slot limit" : `${plan.listings} published Buy Now listings`}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{platformFee(plan.monthlyCents, "CAD")}/month</span>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">Example: 2 published listings on the 10-listing bundle use 2 slots and leave 8. The 30-day listing price and the monthly bundle are billed on different cycles.</p>
        <Link href="/dashboard/buy" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-4 text-sm text-card">Review bundles</Link>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Digital File</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6">
          One shop plan, billed monthly.
          {creatorPlan && growthPlan && creatorPlan.monthlyCents === growthPlan.monthlyCents
            ? ` Creator and Growth are both ${platformFee(creatorPlan.monthlyCents, "CAD")}/month. Creator includes ${creatorPlan.listingsPerCopy} listings at ${formatFeeRate(creatorPlan.feeBps)}. Growth includes ${growthPlan.listingsPerCopy} listings at ${formatFeeRate(growthPlan.feeBps)}.`
            : " Each plan below lists its own listings and platform order fee."}
        </p>
        <div className="mt-4 max-w-xl rounded-xl border border-line bg-card p-2">
          {DIGITAL_PLANS.map((plan, index) => (
            <div key={plan.id} className={`flex items-center justify-between gap-3 px-3 py-3 ${index > 0 ? "border-t border-line" : ""}`}>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{plan.name}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  {plan.listingsPerCopy == null ? "Unlimited listings" : `${listingLimitLabel(plan.listingsPerCopy)} listings`}
                  {plan.stackable ? " · extra copies can be added" : ""}
                  {" · "}{formatFeeRate(plan.feeBps)} platform order fee
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{platformFee(plan.monthlyCents, "CAD")}/month</span>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">Stripe and PayPal payment processing fees are separate and are not included in the platform order fee.</p>
        {creator && growth ? (
          <p className="mt-3 max-w-xl text-sm leading-6">
            Example, before tax: 18 listings and {platformFee(EXAMPLE_SALES_CENTS, "CAD")} chargeable sales. Creator × 2 is {platformFee(creatorTotal, "CAD")} and Growth is {platformFee(growthTotal, "CAD")}. Estimated save {platformFee(growthTotal - creatorTotal, "CAD")}/month with Creator × 2, compared with Growth, on the same sales.
          </p>
        ) : null}
        <Link href="/dashboard/digital" className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-4 text-sm text-card">Review plans</Link>
      </section>
    </main>
  );
}
