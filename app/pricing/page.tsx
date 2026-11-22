import Link from "next/link";
import { platformFee } from "@/lib/billing";
import { BUY_PLANS } from "@/lib/buy-plans";
import { DIGITAL_PLANS, formatFeeRate, listingLimitLabel } from "@/lib/digital-plans";

export const metadata = { title: "Pricing" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-4xl">Pricing</h1>
      <h2 className="mt-8 font-serif text-3xl">Get a Quote</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6">C$4.99 CAD per published listing / month</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        A one-time C$0.50 CAD follow-up fee is added to the next bill the first time Twigigi accepts an email for a site visit, quote, or invoice on that inquiry. Later follow-ups for the same inquiry are included. Receiving an inquiry does not add that fee.
      </p>
      <h2 className="mt-8 font-serif text-3xl">Buy Now bundles</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        A Buy Now bundle is the seller subscription for published Buy Now listings. Prices are CAD per month. C$59.99 is the highest monthly price. Buyer checkout stays with the seller and is not this subscription.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {BUY_PLANS.map((plan) => (
          <article key={plan.id} className="rounded-3xl border border-line bg-card p-5">
            <h3 className="font-serif text-3xl">{plan.name}</h3>
            <p className="mt-3 font-serif text-3xl">{platformFee(plan.monthlyCents, "CAD")}<span className="font-sans text-base text-muted"> / month</span></p>
            <p className="mt-3 text-sm leading-6">{plan.listings == null ? "Unlimited published Buy Now listings. Extra slots are not added." : `${plan.listings} published Buy Now listings. Add 1 or 10 slots on this bundle when you need room.`}</p>
            <Link href={`/dashboard/buy?plan=${plan.id}`} className="mt-5 inline-flex h-11 items-center rounded-full bg-forest px-4 text-sm text-card">
              Review {plan.name}
            </Link>
          </article>
        ))}
      </div>
      <h2 className="mt-12 font-serif text-3xl">Digital File plans</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        One plan covers the whole shop. Prices are in CAD. Buy now and quote listings are not part of these plans.
        A Twigigi platform fee is separate from the payment processing fee charged by Stripe or PayPal.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {DIGITAL_PLANS.map((plan) => (
          <article key={plan.id} className="rounded-3xl border border-line bg-card p-5">
            <h2 className="font-serif text-3xl">{plan.name}</h2>
            <p className="mt-3 font-serif text-3xl">{platformFee(plan.monthlyCents, "CAD")}<span className="font-sans text-base text-muted"> / month</span></p>
            <ul className="mt-4 space-y-2 text-sm leading-6">
              <li>{plan.listingsPerCopy == null ? "Unlimited published Digital File listings" : `${listingLimitLabel(plan.listingsPerCopy)} published Digital File listings per copy`}</li>
              <li>{formatFeeRate(plan.feeBps)} Twigigi platform fee on a qualifying order</li>
              <li>{plan.stackable ? "Extra copies of this same plan can be added. Plans cannot be mixed." : "One copy. It still renews each month."}</li>
            </ul>
            <Link href={`/dashboard/digital?plan=${plan.id}&copies=1`} className="mt-5 inline-flex h-11 items-center rounded-full bg-forest px-4 text-sm text-card">
              Review {plan.name}
            </Link>
          </article>
        ))}
      </div>
      <section className="mt-8 max-w-2xl space-y-3 text-sm leading-6 text-muted">
        <p>Starter is C$1.49 for the shop, including 5 listings. Creator and Growth are both C$14.99. Creator has the lower order fee. Growth includes more listings. Pro is 2.00%. Unlimited is 0.50%.</p>
        <p>Stacking adds listings and monthly price. The order fee stays the rate for that plan. Creator × 2 is 20 listings at C$29.98 per month and 1.50%.</p>
        <p>Only a published Digital File listing uses a slot. Drafts and unpublished listings do not. Several download files on one listing still use one slot.</p>
        <p>The platform fee applies only when Twigigi confirms the payment and can collect an application fee. It is not added to the buyer&apos;s total. External payment links and payments the seller confirms by hand do not create a platform fee.</p>
      </section>
    </main>
  );
}
