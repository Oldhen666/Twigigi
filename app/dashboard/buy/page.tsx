import Link from "next/link";
import { confirmBuyPlan, stopBuyPlanRenewal } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { platformFee } from "@/lib/billing";
import {
  BUY_PLANS,
  activeBuyQuote,
  buyChangeMessage,
  buyPlanChange,
  type BuyOption,
  type BuyRecommendation,
  recommendBuyTarget,
  subscriptionCoversBuy,
} from "@/lib/buy-plans";
import { legacyBuyBilling, readBuySubscription, sellerProducts } from "@/lib/db";
import { buttonClass, ghostClass } from "@/components/ui";

export const metadata = { title: "Buy Now bundle", robots: { index: false, follow: false } };

function slotsLabel(limit: number | null) {
  return limit == null ? "Unlimited" : String(limit);
}

function recommendationCopy(recommendation: BuyRecommendation) {
  const choice = recommendation.recommended;
  const price = platformFee(choice.monthlyCents, "CAD");
  const lines: string[] = [];
  if (recommendation.savingsCents > 0 && choice.listingLimit == null) {
    lines.push(`Go unlimited and save ${platformFee(recommendation.savingsCents, "CAD")}/month.`);
  } else if (recommendation.savingsCents > 0 && choice.listingLimit != null) {
    lines.push(`Save ${platformFee(recommendation.savingsCents, "CAD")}/month with the ${choice.listingLimit}-listing bundle.`);
  }
  if (choice.listingLimit == null && recommendation.stay) {
    lines.push(`Get unlimited Buy Now listings for ${price}/month. Expanding your current bundle to ${recommendation.targetSlots} slots would bring your total to ${platformFee(recommendation.stay.monthlyCents, "CAD")}/month.`);
  } else if (recommendation.stay && choice.listingLimit != null) {
    lines.push(`Get ${choice.listingLimit} listing slots for ${price}/month. Adding ${recommendation.addSlots} slots to your current bundle would bring your total to ${platformFee(recommendation.stay.monthlyCents, "CAD")}/month.`);
  } else {
    lines.push(choice.listingLimit == null ? `Get unlimited Buy Now listings for ${price}/month.` : `Get ${choice.listingLimit} listing slots for ${price}/month.`);
  }
  if (recommendation.gainedSlots == null && choice.listingLimit == null && recommendation.stay) {
    lines.push("This includes unlimited Buy Now listings.");
  } else if (recommendation.gainedSlots != null && recommendation.gainedSlots > 0) {
    lines.push(`You also get ${recommendation.gainedSlots} more listing slot${recommendation.gainedSlots === 1 ? "" : "s"} than the slots you asked to add.`);
  }
  if (recommendation.unlimited && recommendation.unlimited.monthlyCents > choice.monthlyCents) {
    lines.push(`Get unlimited listings for ${platformFee(recommendation.unlimited.monthlyCents - choice.monthlyCents, "CAD")} more per month.`);
  }
  return lines;
}

function ConfirmChoice({
  recommendation,
  option,
  published,
  currentSlots,
  currentMonthlyCents,
  chargeCents,
  label,
}: {
  recommendation: BuyRecommendation;
  option: BuyOption;
  published: number;
  currentSlots: number | null;
  currentMonthlyCents: number;
  chargeCents: number;
  label: string;
}) {
  return (
    <form action={confirmBuyPlan} className="mt-4 rounded-3xl border border-line bg-card p-5">
      <input type="hidden" name="plan" value={option.planId} />
      <input type="hidden" name="extra" value={option.extraSlots} />
      <input type="hidden" name="add" value={recommendation.addSlots} />
      <p className="text-sm leading-6">{published} published. Current allowance {currentSlots == null ? "unlimited" : currentSlots}.</p>
      <p className="mt-2 text-sm leading-6">After confirmation: {slotsLabel(option.listingLimit)} listings, {platformFee(option.monthlyCents, "CAD")} / month.</p>
      <p className="mt-2 text-sm leading-6">{platformFee(currentMonthlyCents, "CAD")} / month → {platformFee(option.monthlyCents, "CAD")} / month.</p>
      <p className="mt-2 text-sm leading-6">{chargeCents > 0 ? `Due today: ${platformFee(chargeCents, "CAD")}.` : "Nothing is due today. Closing this page does not charge you."}</p>
      <button className={`${buttonClass} mt-4`}>{label}</button>
    </form>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireSeller();
  const current = readBuySubscription(user.id);
  const active = activeBuyQuote(current);
  const covered = subscriptionCoversBuy(current);
  const published = sellerProducts(user.id).filter((product) => product.cta === "buy" && product.status === "published").length;
  const legacy = legacyBuyBilling(user.id);
  const addSlots = Number(typeof params.add === "string" ? params.add : "0");
  const requestedPlan = typeof params.plan === "string" ? params.plan : "";
  const recommendation = addSlots >= 1 ? recommendBuyTarget({ current: active, published, addSlots }) : null;
  const notice = typeof params.notice === "string" ? params.notice : "";
  const noticeText = notice === "saved"
    ? "The bundle choice is saved. Nothing else was charged, and a paid bill was not rewritten."
    : notice === "cancel"
      ? "Renewal is off. This period stays in place, and the amount already paid is not refunded."
      : notice === "no_plan" || notice === "quota"
        ? "The draft is saved. Choose a bundle or add slots before it can be published."
        : notice
          ? buyChangeMessage(notice)
          : "";
  const now = new Date().toISOString();
  const chargeFor = (planId: string, extraSlots: number) => {
    const change = buyPlanChange({ userId: user.id, current, planId, extraSlots, published, now });
    return change.ok && change.kind === "bill" ? change.chargeCents : 0;
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <h1 className="font-serif text-4xl">Buy Now bundle</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        This is the shop subscription for published Buy Now listings. Buyer payments stay with the seller. Drafts do not use a slot. Unpublishing frees a slot.
      </p>
      {noticeText ? <p className="mt-4 rounded-2xl bg-paper-deep px-4 py-3 text-sm leading-6">{noticeText}</p> : null}
      <section className="mt-6 rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Current bundle</h2>
        {active && covered ? (
          <p className="mt-2 text-sm leading-6">
            {active.plan.name}{active.extraSlots > 0 ? ` + ${active.extraSlots} slots` : ""}: {slotsLabel(active.listingLimit)} listings, {platformFee(active.monthlyCents, "CAD")} / month.
            {" "}{published} published.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted">No active bundle. {published} Buy Now listings are published now. A new publish needs a bundle with room.</p>
        )}
        {active && active.listingLimit != null ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/buy?add=1" className={buttonClass}>Add 1 listing slot</Link>
            <Link href="/dashboard/buy?add=10" className={ghostClass}>Add 10 listing slots</Link>
          </div>
        ) : null}
        {covered ? (
          <form action={stopBuyPlanRenewal} className="mt-4">
            <button className="text-sm font-medium text-forest">Stop renewal</button>
          </form>
        ) : null}
      </section>
      {recommendation ? (
        <section className="mt-6">
          <h2 className="font-serif text-2xl">Confirm {recommendation.addSlots === 1 ? "1 added slot" : `${recommendation.addSlots} added slots`}</h2>
          {recommendationCopy(recommendation).map((line) => <p key={line} className="mt-3 text-sm leading-6">{line}</p>)}
          <ConfirmChoice
            recommendation={recommendation}
            option={recommendation.recommended}
            published={published}
            currentSlots={active?.listingLimit ?? 0}
            currentMonthlyCents={active?.monthlyCents ?? 0}
            chargeCents={chargeFor(recommendation.recommended.planId, recommendation.recommended.extraSlots)}
            label={recommendation.recommended.planId === active?.plan.id ? `Add ${recommendation.addSlots} listing slot${recommendation.addSlots === 1 ? "" : "s"}` : `Switch to ${recommendation.recommended.name}`}
          />
          {recommendation.unlimited ? (
            <ConfirmChoice
              recommendation={recommendation}
              option={recommendation.unlimited}
              published={published}
              currentSlots={active?.listingLimit ?? 0}
              currentMonthlyCents={active?.monthlyCents ?? 0}
              chargeCents={chargeFor(recommendation.unlimited.planId, recommendation.unlimited.extraSlots)}
              label="Switch to Unlimited"
            />
          ) : null}
          {recommendation.stay && recommendation.stay.purchasable && recommendation.stay.planId !== recommendation.recommended.planId ? (
            <ConfirmChoice
              recommendation={recommendation}
              option={recommendation.stay}
              published={published}
              currentSlots={active?.listingLimit ?? 0}
              currentMonthlyCents={active?.monthlyCents ?? 0}
              chargeCents={chargeFor(recommendation.stay.planId, recommendation.stay.extraSlots)}
              label="Stay on the current bundle"
            />
          ) : null}
          <p className="mt-3 text-sm text-muted">Opening or leaving this page does not charge the card and does not change the allowance.</p>
        </section>
      ) : null}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {BUY_PLANS.map((plan) => {
          const blocked = plan.listings != null && published > plan.listings;
          return (
            <article key={plan.id} className="rounded-3xl border border-line bg-card p-5">
              <h2 className="font-serif text-2xl">{plan.name}</h2>
              <p className="mt-2 font-serif text-3xl">{platformFee(plan.monthlyCents, "CAD")}<span className="font-sans text-base text-muted"> / month</span></p>
              <p className="mt-3 text-sm leading-6">{plan.listings == null ? "Unlimited published Buy Now listings." : `${plan.listings} published Buy Now listings.`}</p>
              {blocked ? <p className="mt-2 text-sm text-muted">{published} are already published, so this bundle needs added slots or a larger bundle.</p> : null}
              {requestedPlan === plan.id && !recommendation ? (
                <form action={confirmBuyPlan} className="mt-4">
                  <input type="hidden" name="plan" value={plan.id} />
                  <input type="hidden" name="extra" value="0" />
                  <input type="hidden" name="add" value="0" />
                  <button className={buttonClass} disabled={blocked}>Confirm {plan.name}</button>
                </form>
              ) : (
                <Link href={`/dashboard/buy?plan=${plan.id}`} className="mt-4 inline-flex text-sm font-medium text-forest">Review {plan.name}</Link>
              )}
            </article>
          );
        })}
      </section>
      {legacy.openUnpaidBuyListingBills > 0 || legacy.paidBuyListingBills > 0 ? (
        <p className="mt-6 text-sm leading-6 text-muted">
          Existing per-listing Buy Now bills stay as they are: {legacy.openUnpaidBuyListingBills} open, {legacy.paidBuyListingBills} paid. Buying a bundle does not reprice them.
        </p>
      ) : null}
    </main>
  );
}
