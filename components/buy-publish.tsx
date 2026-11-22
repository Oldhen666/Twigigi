import Link from "next/link";
import { BuyPlanCompare, type ComparePlanRow } from "@/components/buy-plan-compare";
import { confirmBuyPlan, publishBuyDraft, publishBuyListing } from "@/lib/actions";
import { platformFee } from "@/lib/billing";
import {
  BUY_PLANS,
  buyPlanChange,
  publishRecommendationCopy,
  type BuyQuote,
  type BuySubscription,
  type PublishBuyOffer,
  type PublishListingOption,
} from "@/lib/buy-plans";
import { buttonClass } from "@/components/ui";

function planDetail(option: PublishListingOption, current: BuyQuote | null, offer: PublishBuyOffer) {
  if (!current || !offer.baseline || !offer.recommendation) return "";
  if (offer.recommendation.option.planId !== option.planId || offer.recommendation.option.extraSlots !== option.extraSlots) return "";
  return publishRecommendationCopy(offer.recommendation, offer.baseline);
}

function starterBundleCopy(listingLabel: string) {
  const plan = BUY_PLANS.find((item) => item.id === "buy_now_10") ?? BUY_PLANS[0];
  const slots = plan.listings ?? plan.name;
  return `Keep paying ${listingLabel} every 30 days, or choose a bundle for up to ${slots} listings at ${platformFee(plan.monthlyCents, "CAD")}/month.`;
}

function bundleSummary(choice: PublishListingOption, needed: number) {
  if (choice.listingLimit == null) return `${choice.heading}. Publish this Twig and add more listings without a slot limit.`;
  const left = choice.listingLimit - needed;
  const benefit = left === 1
    ? "Publish this Twig and keep 1 slot for future listings."
    : left > 1
      ? `Publish this Twig and keep ${left} slots for future listings.`
      : "Publish this Twig. No slots remain for future listings.";
  return `${choice.heading}. ${benefit}`;
}

function compareRows({ offer, current, listingLabel }: { offer: PublishBuyOffer; current: BuyQuote | null; listingLabel: string }): ComparePlanRow[] {
  const rows: ComparePlanRow[] = [];
  if (!current) {
    rows.push({ id: "listing", name: "Single listing", detail: "", price: listingLabel, period: "every 30 days" });
  }
  for (const option of offer.options) {
    const base = option.listingLimit == null ? option.name : option.extraSlots > 0 ? `${option.listingLimit - option.extraSlots} Listings` : option.name;
    const name = option.extraSlots > 0 && option.listingLimit != null
      ? `${base} + ${option.extraSlots === 1 ? "1 slot" : `${option.extraSlots} slots`}`
      : option.name;
    rows.push({
      id: `${option.planId}:${option.extraSlots}`,
      name,
      detail: planDetail(option, current, offer),
      price: platformFee(option.monthlyCents, "CAD"),
      period: "per month",
    });
  }
  return rows;
}

function MoneyRow({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-ink" : "text-sm text-muted"}`}>
      <dt>{label}</dt>
      <dd className={strong ? "text-xl font-semibold tabular-nums" : "tabular-nums"}>{amount}</dd>
    </div>
  );
}

export function BuyPublish({
  productId,
  title,
  draftSaved,
  offer,
  selected,
  current,
  subscription,
  userId,
  published,
  openCheckoutUrl,
  listingCheckoutUrl,
  listingLabel,
  notice,
  ready,
  compareOpen,
}: {
  productId: string;
  title: string;
  draftSaved: boolean;
  offer: PublishBuyOffer;
  selected: PublishListingOption | null;
  current: BuyQuote | null;
  subscription: BuySubscription | null;
  userId: string;
  published: number;
  openCheckoutUrl: string;
  listingCheckoutUrl: string;
  listingLabel: string;
  notice: string;
  ready: boolean;
  compareOpen: boolean;
}) {
  const choice = selected ?? (current ? offer.baseline : null);
  const change = choice
    ? buyPlanChange({
        userId,
        current: subscription,
        planId: choice.planId,
        extraSlots: choice.extraSlots,
        published,
        now: new Date().toISOString(),
      })
    : null;
  const dueCents = change?.ok && change.kind === "bill" ? change.chargeCents : 0;
  const checkout = Boolean(change?.ok && change.kind === "bill" && change.chargeCents > 0);
  const samePlanAdd = Boolean(current && choice && choice.planId === current.plan.id && choice.extraSlots > current.extraSlots);
  const addedSlots = samePlanAdd && current && choice ? choice.extraSlots - current.extraSlots : 0;
  const editor = `/dashboard/products/${productId}`;
  const listingSelected = !current && !choice;
  const noticeText = notice === "canceled"
    ? "Payment was canceled."
    : notice === "payment"
      ? "Payment did not start."
      : notice === "pending"
        ? "A Buy Now payment is already open. A second subscription was not started."
        : notice === "waiting"
          ? "The subscription is not confirmed yet."
          : notice === "ready"
            ? "The plan is updated. Publish this Twig when you are ready."
            : notice === "returned" && offer.included
              ? "The subscription is confirmed. Publish this Twig when you are ready."
              : notice === "returned" && listingSelected
                ? "The payment is not confirmed yet."
                : notice === "returned"
                  ? "The payment is not confirmed yet. This Twig is still a draft."
                  : notice === "quota"
                    ? "This plan does not have room for the Twig yet."
                    : "";
  const resumeCheckout = Boolean(openCheckoutUrl && notice !== "returned" && notice !== "canceled");
  const resumeListing = Boolean(listingCheckoutUrl && notice !== "returned" && notice !== "canceled");
  const planPicker = ready && !offer.included && (offer.options.length > 0 || !current) ? (
    <BuyPlanCompare
      productId={productId}
      rows={compareRows({ offer, current, listingLabel })}
      selectedId={listingSelected ? "listing" : choice ? `${choice.planId}:${choice.extraSlots}` : "listing"}
      initiallyOpen={compareOpen}
      title={listingSelected ? "Planning to list more items?" : "Need more listing slots?"}
      subtitle={listingSelected ? starterBundleCopy(listingLabel) : choice ? bundleSummary(choice, offer.neededSlots) : ""}
    />
  ) : null;

  return (
    <main className="mx-auto w-full max-w-[600px] px-5 py-8">
      <Link href={editor} className="text-sm text-muted">← Back to draft</Link>
      <h1 className="mt-5 font-serif text-4xl">Publish your Buy Now Twig</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-lg">{title}</p>
        <span className="rounded-md bg-paper-deep px-2 py-0.5 text-xs text-muted">{draftSaved ? "Draft saved" : "Saved"}</span>
      </div>
      {noticeText ? <p className="mt-3 text-sm text-muted">{noticeText}</p> : null}
      {!ready ? (
        <p className="mt-6 text-sm leading-6">This Twig needs a title and a photo before it can be published.</p>
      ) : offer.included ? (
        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h2 className="text-base font-medium">Included in your plan</h2>
          <dl className="mt-5">
            <MoneyRow label="Due today" amount="C$0.00" strong />
          </dl>
          <form action={publishBuyDraft} className="mt-5">
            <input type="hidden" name="id" value={productId} />
            <button className={`${buttonClass} w-full`}>Publish Twig</button>
          </form>
        </section>
      ) : listingSelected ? (
        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h2 className="text-base font-medium">Listing subscription</h2>
          <dl className="mt-5 space-y-2">
            <MoneyRow label="Due today" amount={listingLabel} strong />
            <MoneyRow label="Renews every 30 days" amount={listingLabel} />
          </dl>
          {resumeListing ? (
            <a href={listingCheckoutUrl} className={`${buttonClass} mt-5 w-full`}>Return to checkout</a>
          ) : (
            <form action={publishBuyListing} className="mt-5">
              <input type="hidden" name="id" value={productId} />
              <button className={`${buttonClass} w-full`}>Continue to checkout</button>
            </form>
          )}
          <p className="mt-3 text-sm text-muted">Your Twig will be published once payment is confirmed.</p>
          {planPicker}
        </section>
      ) : choice ? (
        <section className="mt-6 rounded-xl border border-line bg-card p-5">
          <h2 className="text-base font-medium">{choice.heading}</h2>
          <dl className="mt-5 space-y-2">
            <MoneyRow label="Due today" amount={platformFee(dueCents, "CAD")} strong />
            <MoneyRow label="Renews monthly" amount={platformFee(choice.monthlyCents, "CAD")} />
            {samePlanAdd ? (
              <MoneyRow label="Added slots" amount={addedSlots === 1 ? "1 listing slot" : `${addedSlots} listing slots`} />
            ) : (
              <MoneyRow label="Listing slots" amount={choice.listingLimit == null ? "Unlimited" : String(choice.listingLimit)} />
            )}
          </dl>
          {offer.blockedAddCents != null && choice.planId === "buy_now_unlimited" ? (
            <p className="mt-3 text-sm text-muted">Adding a slot on the current plan would be {platformFee(offer.blockedAddCents, "CAD")}/month.</p>
          ) : null}
          {resumeCheckout ? (
            <a href={openCheckoutUrl} className={`${buttonClass} mt-5 w-full`}>Return to checkout</a>
          ) : (
            <form action={confirmBuyPlan} className="mt-5">
              <input type="hidden" name="draft" value={productId} />
              <input type="hidden" name="plan" value={choice.planId} />
              <input type="hidden" name="extra" value={choice.extraSlots} />
              <input type="hidden" name="add" value="1" />
              <button className={`${buttonClass} w-full`}>{checkout ? "Continue to checkout" : "Update plan"}</button>
            </form>
          )}
          <p className="mt-3 text-sm text-muted">
            {checkout ? "Your Twig stays a draft until you publish it." : "This does not charge today. You publish the Twig after the plan updates."}
          </p>
          {planPicker}
        </section>
      ) : null}
    </main>
  );
}
