import Link from "next/link";
import { confirmDigitalPlan, stopDigitalPlanRenewal } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { platformFee } from "@/lib/billing";
import {
  DIGITAL_PLANS,
  activePlanQuote,
  digitalChangeMessage,
  formatFeeRate,
  listingLimitLabel,
  quoteDigitalPlan,
  singlePlanAlternative,
  subscriptionCovers,
} from "@/lib/digital-plans";
import { legacyDigitalBilling, readDigitalSubscription, sellerProducts } from "@/lib/db";
import { buttonClass, ghostClass, inputClass } from "@/components/ui";

export const metadata = { title: "Digital File plan", robots: { index: false, follow: false } };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSeller();
  const current = readDigitalSubscription(user.id);
  const active = activePlanQuote(current);
  const covered = subscriptionCovers(current);
  const published = sellerProducts(user.id).filter((product) => product.cta === "file" && product.status === "published").length;
  const legacy = legacyDigitalBilling(user.id);
  const requested = typeof params.plan === "string" ? params.plan : active?.plan.id || "starter";
  const requestedCopies = Number(typeof params.copies === "string" ? params.copies : "1");
  const selection = quoteDigitalPlan(requested, Number.isInteger(requestedCopies) ? requestedCopies : 1);
  const alternative = selection ? singlePlanAlternative(selection) : null;
  const notice = typeof params.notice === "string" ? params.notice : "";
  const noticeText = notice === "saved"
    ? "The plan choice is saved. A paid bill was not rewritten."
    : notice === "cancel"
      ? "Renewal is off. This period stays in place, and the amount already paid is not refunded."
      : notice === "payment"
        ? "The plan payment did not open. Nothing new was marked paid."
        : notice
          ? digitalChangeMessage(notice, selection?.listingLimit ?? null, published)
          : "";

  return (
    <main className="page-frame pb-16">
      <h1 className="mt-6 font-serif text-4xl">Digital File plan</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        The shop uses one plan at a time. Confirm the listing allowance, monthly total, and platform fee before paying.
        <Link href="/pricing" className="ml-1 text-forest">View pricing</Link>
      </p>

      <section className="mt-6 max-w-xl rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">This shop</h2>
        {covered && active ? (
          <>
            <p className="mt-2 text-sm leading-6">{active.plan.name} × {active.copies}</p>
            <p className="mt-1 text-sm leading-6">{listingLimitLabel(active.listingLimit)} published listings · {platformFee(active.monthlyCents, "CAD")} / month · {formatFeeRate(active.feeBps)} platform fee</p>
            <p className="mt-1 text-sm text-muted">{published} published now{active.listingLimit == null ? "" : ` · ${Math.max(active.listingLimit - published, 0)} open`}</p>
            {current?.pendingPlanId ? <p className="mt-2 text-sm">A lower plan is scheduled at the next renewal. The current allowance stays until then.</p> : null}
            {current?.autoRenew ? (
              <form action={stopDigitalPlanRenewal} className="mt-4">
                <button className={ghostClass}>Stop renewal</button>
              </form>
            ) : <p className="mt-3 text-sm text-muted">Renewal is off. The current period is not refunded.</p>}
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted">No Digital File plan is active. Drafts can be saved. Publishing needs a plan.</p>
        )}
        <p className="mt-4 text-sm leading-6 text-muted">
          Stripe confirms a card payment on the seller&apos;s connected account and does not set an application fee. PayPal pays the seller&apos;s email and does not set a platform fee.
          An order can store the plan rate, and that stored amount is not money Twigigi has collected. Payment processing fees from Stripe or PayPal are separate.
        </p>
        {legacy.openUnpaidFileListingBills > 0 || legacy.paidFileListingBills > 0 ? (
          <p className="mt-3 text-sm leading-6">
            Existing per-listing digital charges stay as they are: {legacy.paidFileListingBills} paid ({platformFee(legacy.paidFileListingCents, "CAD")}) and {legacy.openUnpaidFileListingBills} still open ({platformFee(legacy.openUnpaidFileListingCents, "CAD")}).
            This plan does not reprice or void them.
          </p>
        ) : null}
      </section>

      {noticeText ? <p className="mt-4 max-w-xl text-sm leading-6">{noticeText}</p> : null}

      <form method="get" className="mt-8 max-w-xl space-y-4">
        <label className="block text-sm font-medium">
          Plan
          <select name="plan" defaultValue={selection?.plan.id || "starter"} className={`${inputClass} mt-1`}>
            {DIGITAL_PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Copies
          <input name="copies" type="number" min={1} max={99} defaultValue={selection?.copies || 1} className={`${inputClass} mt-1`} />
        </label>
        <button className={ghostClass}>Update the summary</button>
      </form>

      {selection ? (
        <form action={confirmDigitalPlan} className="mt-6 max-w-xl rounded-3xl border border-line bg-card p-5">
          <input type="hidden" name="plan" value={selection.plan.id} />
          <input type="hidden" name="copies" value={selection.copies} />
          <h2 className="font-serif text-2xl">Confirm {selection.plan.name} × {selection.copies}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt>Published listing allowance</dt><dd>{listingLimitLabel(selection.listingLimit)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Monthly total</dt><dd>{platformFee(selection.monthlyCents, "CAD")}</dd></div>
            <div className="flex justify-between gap-4"><dt>Platform order fee</dt><dd>{formatFeeRate(selection.feeBps)}</dd></div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-muted">The buyer&apos;s payment processing fee is charged by Stripe or PayPal. It is not included in the platform fee above.</p>
          {!selection.plan.stackable ? <p className="mt-2 text-sm">This plan is one copy. Monthly renewal still works.</p> : null}
          {alternative ? (
            <p className="mt-3 text-sm leading-6">
              {alternative.plan.name} includes {listingLimitLabel(alternative.listingLimit)} listings for {platformFee(alternative.monthlyCents, "CAD")} / month at {formatFeeRate(alternative.feeBps)}.
              That single copy covers at least as many listings, and neither the monthly price nor the order fee is higher.
              <Link href={`/dashboard/digital?plan=${alternative.plan.id}&copies=1`} className="ml-1 text-forest">Review {alternative.plan.name}</Link>
            </p>
          ) : null}
          <button className={`${buttonClass} mt-5`}>Confirm this plan</button>
        </form>
      ) : (
        <p className="mt-6 max-w-xl text-sm">Starter and Unlimited cannot be bought as two copies. Choose 1, or choose Creator, Growth, or Pro to add copies.</p>
      )}
    </main>
  );
}
