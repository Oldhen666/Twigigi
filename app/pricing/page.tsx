import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { PricingEstimator } from "@/components/pricing-estimator";
import { buttonClass } from "@/components/ui";
import { LISTING_CENTS, platformFee } from "@/lib/billing";
import { BUY_PLANS } from "@/lib/buy-plans";
import { DIGITAL_PLANS, formatFeeRate, listingLimitLabel } from "@/lib/digital-plans";
import { readCta } from "@/lib/format";
import { QUOTE_FOLLOWUP_CENTS, QUOTE_LISTING_CENTS, quoteFollowupRules } from "@/lib/quote-followup";

export const metadata = { title: "Pricing" };

type PricingKind = "buy" | "file" | "quote";

function perListingCost(monthlyCents: number, listings: number) {
  return platformFee(Math.round(monthlyCents / listings), "CAD");
}

function pricingKind(value: string | undefined): PricingKind {
  const cta = readCta(value);
  return cta === "file" || cta === "quote" ? cta : "buy";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selected = pricingKind(typeof params.cta === "string" ? params.cta : undefined);
  const starter = DIGITAL_PLANS[0];
  const rules = quoteFollowupRules();
  const entries = [
    {
      id: "buy" as const,
      title: "Buy Now",
      purpose: "Share a product link by text or QR code. Customers can choose their options and select pickup if you offer it.",
      price: `Only ${platformFee(LISTING_CENTS, "CAD")} per listing per month or bulk bundle price.`,
      href: "/pricing",
    },
    {
      id: "file" as const,
      title: "Digital File",
      purpose: "Sell a downloadable file on a monthly shop plan, plus a platform order fee.",
      price: `From ${platformFee(starter?.monthlyCents ?? 0, "CAD")}/month, plus a platform order fee.`,
      href: "/pricing?cta=file",
    },
    {
      id: "quote" as const,
      title: "Get a Quote",
      purpose: "Share a service link. Ask for the job details you need, one step away for your customer to get a quotation from you.",
      price: `${platformFee(QUOTE_LISTING_CENTS, "CAD")} per listing each month, plus ${platformFee(QUOTE_FOLLOWUP_CENTS, "CAD")} for a first follow-up.`,
      href: "/pricing?cta=quote",
    },
  ];

  return (
    <main className="page-frame py-10">
      <BackButton href="/" />
      <h1 className="mt-6 font-serif text-4xl">Pricing for the way you sell</h1>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {entries.map((entry) => {
          const current = entry.id === selected;
          return (
            <Link
              key={entry.id}
              href={entry.href}
              aria-current={current ? "page" : undefined}
              className={`rounded-[28px] border p-5 ${current ? "border-forest bg-card" : "border-line bg-card"}`}
            >
              <p className="text-xl font-medium text-forest">{entry.title}</p>
              <p className="mt-2 text-sm leading-6">{entry.purpose}</p>
              <p className="mt-3 text-sm font-medium leading-6">{entry.price}</p>
            </Link>
          );
        })}
      </div>

      {selected === "buy" ? (
        <section className="mt-10" aria-label="Buy Now">
          <h2 className="font-serif text-3xl">Buy Now</h2>
          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-serif text-5xl tabular-nums leading-none">{platformFee(LISTING_CENTS, "CAD")}</p>
            <p className="text-sm text-muted">every 30 days</p>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">One published listing renews on its own 30-day cycle. Drafts do not use a slot. A bundle is optional and renews monthly.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BUY_PLANS.map((plan) => (
              <article key={plan.id} className="flex h-full flex-col rounded-[28px] border border-line bg-card p-5">
                <p className="text-sm font-medium text-forest">{plan.name}</p>
                <p className="mt-3 font-serif text-4xl tabular-nums leading-none">{platformFee(plan.monthlyCents, "CAD")}</p>
                <p className="mt-2 text-sm text-muted">/month</p>
                <p className="mt-5 text-sm font-medium">{plan.listings == null ? "No listing cap" : `${plan.listings} listings`}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{plan.listings == null ? "Extra slots are not added." : `${perListingCost(plan.monthlyCents, plan.listings)} per listing`}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 max-w-3xl rounded-2xl bg-moss px-4 py-4 text-sm leading-6">After a bundle is active, the published Buy Now listings you already have use that bundle. The next listing fee is not added for them. A bill already open, and a period already paid, stay in place.</p>
          <Link href="/dashboard/buy" className={`${buttonClass} mt-6`}>Start with a bundle</Link>
        </section>
      ) : null}

      {selected === "file" ? (
        <section className="mt-10" aria-label="Digital File">
          <h2 className="font-serif text-3xl">Digital File</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">One shop plan, billed monthly. Creator and Growth cost the same per month. Creator includes fewer listings and a lower platform order fee.</p>
          <div className="mt-4 hidden overflow-hidden rounded-[28px] border border-line bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Listings</th>
                  <th className="px-4 py-3 font-medium">Monthly price</th>
                  <th className="px-4 py-3 font-medium">Platform order fee</th>
                </tr>
              </thead>
              <tbody>
                {DIGITAL_PLANS.map((plan) => (
                  <tr key={plan.id} className="border-t border-line first:border-t-0">
                    <th className="px-4 py-4 font-medium">{plan.name}</th>
                    <td className="px-4 py-4">{plan.listingsPerCopy == null ? "No listing cap" : listingLimitLabel(plan.listingsPerCopy)}</td>
                    <td className="px-4 py-4">
                      <span className="font-serif text-2xl tabular-nums">{platformFee(plan.monthlyCents, "CAD")}</span>
                      <span className="mt-1 block text-xs text-muted">/month</span>
                    </td>
                    <td className="px-4 py-4 tabular-nums">{formatFeeRate(plan.feeBps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-3 md:hidden">
            {DIGITAL_PLANS.map((plan) => (
              <article key={plan.id} className="rounded-[28px] border border-line bg-card p-4">
                <p className="font-medium">{plan.name}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Listings</dt>
                    <dd>{plan.listingsPerCopy == null ? "No listing cap" : listingLimitLabel(plan.listingsPerCopy)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Monthly price</dt>
                    <dd>
                      <span className="font-serif text-2xl tabular-nums">{platformFee(plan.monthlyCents, "CAD")}</span>
                      <span className="ml-1 text-xs text-muted">/month</span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Platform order fee</dt>
                    <dd className="tabular-nums">{formatFeeRate(plan.feeBps)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Creator, Growth, and Pro can add copies. Starter and Unlimited stay at one copy.</p>
          <PricingEstimator />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Stripe and PayPal payment processing fees are separate and are not included in the platform order fee.</p>
          <Link href="/dashboard/digital" className={`${buttonClass} mt-6`}>Review plans</Link>
        </section>
      ) : null}

      {selected === "quote" ? (
        <section className="mt-10" aria-label="Get a Quote">
          <h2 className="font-serif text-3xl">Get a Quote</h2>
          <article className="mt-4 max-w-2xl rounded-[28px] border border-line bg-card p-5">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="font-serif text-5xl tabular-nums leading-none">{platformFee(QUOTE_LISTING_CENTS, "CAD")}</p>
                <p className="mt-3 text-sm leading-6 text-muted">per published listing / month</p>
              </div>
              <div>
                <p className="font-serif text-5xl tabular-nums leading-none">{platformFee(QUOTE_FOLLOWUP_CENTS, "CAD")}</p>
                <p className="mt-3 text-sm leading-6 text-muted">per inquiry, the first time you send a follow-up</p>
                <p className="mt-1 text-sm font-medium text-forest">Further follow-ups included</p>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm leading-6">
              <p>{rules[3]}</p>
              <p className="text-muted">{rules[1]}</p>
            </div>
            <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
              <dt>1 listing</dt>
              <dd className="tabular-nums">{platformFee(QUOTE_LISTING_CENTS, "CAD")}</dd>
              <dt>First follow-ups on 5 inquiries</dt>
              <dd className="tabular-nums">{platformFee(QUOTE_FOLLOWUP_CENTS * 5, "CAD")}</dd>
              <dt className="font-medium">Before tax</dt>
              <dd className="font-serif text-2xl tabular-nums">{platformFee(QUOTE_LISTING_CENTS + QUOTE_FOLLOWUP_CENTS * 5, "CAD")}</dd>
            </dl>
            <p className="mt-3 text-sm leading-6 text-muted">This assumes the next bill includes that listing renewal and these follow-up fees.</p>
          </article>
          <Link href="/new?cta=quote" className={`${buttonClass} mt-6`}>Create a quote listing</Link>
        </section>
      ) : null}
    </main>
  );
}
