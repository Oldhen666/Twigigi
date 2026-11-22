import Link from "next/link";
import { stopBuyPlanRenewal } from "@/lib/actions";
import { requireSeller } from "@/lib/auth";
import { formatListingFee, listingFeeCurrency, platformFee } from "@/lib/billing";
import { BuyBundlePicker, type BuyBundleRow } from "@/components/buy-bundle-picker";
import { BuyPublish } from "@/components/buy-publish";
import {
  BUY_PLANS,
  activeBuyQuote,
  buyChangeMessage,
  buyExpansionCopy,
  buyPlanChange,
  publishBuyOffer,
  publishChoice,
  recommendBuyTarget,
} from "@/lib/buy-plans";
import { getProductById, legacyBuyBilling, openBuyPlanCheckout, openListingCheckout, readBuySubscription, sellerProducts } from "@/lib/db";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Buy Now bundles", robots: { index: false, follow: false } };

function publishedLabel(count: number) {
  return count === 1 ? "1 published listing" : `${count} published listings`;
}

function coverCopy(limit: number | null, published: number) {
  if (published <= 0) {
    if (limit == null) return "No slot limit for new listings.";
    return limit === 1 ? "1 slot for a new listing." : `${limit} slots for new listings.`;
  }
  const covered = published === 1 ? "your listing" : `your ${published} listings`;
  if (limit == null) return `Cover ${covered}, with no slot limit.`;
  const more = limit - published;
  if (more === 1) return `Cover ${covered} and get 1 more slot.`;
  if (more > 1) return `Cover ${covered} and get ${more} more slots.`;
  return `Cover ${covered}. No slots remain for new listings.`;
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
  const products = sellerProducts(user.id);
  const publishedBuy = products.filter((product) => product.cta === "buy" && product.status === "published");
  const published = publishedBuy.length;
  const legacy = legacyBuyBilling(user.id);
  const requestedPlan = typeof params.plan === "string" ? params.plan : "";
  const notice = typeof params.notice === "string" ? params.notice : "";
  const draftId = typeof params.draft === "string" ? params.draft : "";
  const draft = draftId ? getProductById(draftId) : null;
  const owned = draft && draft.userId === user.id && draft.cta === "buy" ? draft : null;
  if (owned?.status === "published" && (notice === "published" || notice === "returned")) {
    return (
      <main className="mx-auto w-full max-w-[600px] px-5 py-8">
        <h1 className="font-serif text-4xl">Your Twig is published</h1>
        <p className="mt-3 text-lg">{owned.title}</p>
        <Link href={`/${user.publicId}/${owned.slug}`} className={`${buttonClass} mt-6`}>View Twig</Link>
      </main>
    );
  }
  if (owned && (owned.status === "draft" || owned.status === "deactivated")) {
    const offer = publishBuyOffer({ current: active, published });
    const selected = publishChoice(typeof params.choice === "string" ? params.choice : "", offer);
    return (
      <BuyPublish
        productId={owned.id}
        title={owned.title}
        draftSaved={owned.status === "draft"}
        offer={offer}
        selected={selected}
        current={active}
        subscription={current}
        userId={user.id}
        published={published}
        openCheckoutUrl={openBuyPlanCheckout(user.id)?.url ?? ""}
        listingCheckoutUrl={openListingCheckout(user.id)?.url ?? ""}
        listingLabel={formatListingFee(listingFeeCurrency(owned.cta, owned.location))}
        notice={notice}
        ready={owned.title.trim().length >= 2 && owned.images.length > 0}
        compareOpen={params.compare === "1" || (typeof params.choice === "string" && params.choice.length > 0)}
      />
    );
  }
  const noticeText = notice === "saved"
    ? "The bundle is updated. Nothing else was charged."
    : notice === "cancel"
      ? "Renewal is off. This period stays in place."
      : notice === "quota"
        ? "That bundle does not cover the listings already published."
        : notice === "no_plan"
          ? "The draft is saved."
          : notice
            ? buyChangeMessage(notice)
            : "";
  const now = new Date().toISOString();
  const requestedAdd = Number(typeof params.add === "string" ? params.add : "");
  const expansion = active && Number.isInteger(requestedAdd) && requestedAdd >= 1
    ? recommendBuyTarget({ current: active, published, addSlots: requestedAdd })
    : null;
  const expansionCopy = expansion ? buyExpansionCopy(expansion) : "";
  const perListingRates = [...new Set(publishedBuy.map((product) => formatListingFee(listingFeeCurrency(product.cta, product.location))))].sort();
  const perListingNote = !active && published > 0
    ? `You can keep paying ${(perListingRates.length > 0 ? perListingRates : [formatListingFee("CAD")]).join(" or ")} every 30 days for each published listing.`
    : "";
  const perListing = !active && legacy.buyListingsWithListingBills > 0;
  const status = active
    ? `${active.listingLimit == null ? "Unlimited bundle" : `${active.listingLimit}-listing bundle`} · ${active.listingLimit == null ? publishedLabel(published) : `${published} of ${active.listingLimit} published`} · ${platformFee(active.monthlyCents, "CAD")}/month`
    : perListing
      ? `Pay per listing · ${publishedLabel(published)}`
      : `No active bundle · ${publishedLabel(published)}`;
  const rows: BuyBundleRow[] = BUY_PLANS.map((plan) => {
    const blocked = plan.listings != null && published > plan.listings;
    const currentPlan = Boolean(active && active.plan.id === plan.id && active.extraSlots === 0);
    const change = buyPlanChange({ userId: user.id, current, planId: plan.id, extraSlots: 0, published, now });
    const dueCents = change.ok && change.kind === "bill" ? change.chargeCents : 0;
    return {
      id: plan.id,
      label: plan.listings == null ? "Unlimited listings" : `${plan.listings} listings`,
      price: `${platformFee(plan.monthlyCents, "CAD")}/month`,
      due: platformFee(dueCents, "CAD"),
      renewal: `${platformFee(plan.monthlyCents, "CAD")}/month`,
      slots: expansionCopy && expansion?.recommended.planId === plan.id && expansion.recommended.extraSlots === 0
        ? expansionCopy
        : coverCopy(plan.listings, published),
      current: currentPlan,
      confirmable: !blocked && !currentPlan && change.ok,
    };
  });
  const initialId = rows.some((row) => row.id === requestedPlan) ? requestedPlan : active?.extraSlots === 0 ? active.plan.id : "";

  return (
    <main className="mx-auto w-full max-w-[600px] px-5 py-8">
      <h1 className="font-serif text-4xl">Buy Now bundles</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{status}</p>
      {active ? (
        <form action={stopBuyPlanRenewal} className="mt-2">
          <button className="text-sm text-muted">Stop renewal</button>
        </form>
      ) : null}
      {perListingNote ? <p className="mt-3 text-sm leading-6 text-muted">{perListingNote}</p> : null}
      {legacy.openUnpaidBuyListingBills > 0 ? (
        <p className="mt-3 text-sm leading-6">
          Your existing listing bill is still due. <Link href="/dashboard/payments?tab=receipts" className="font-medium text-forest">View bill</Link>
        </p>
      ) : null}
      {active && active.listingLimit != null ? (
        <form method="get" className="mt-4 flex items-end gap-2">
          <label className="text-sm">
            More slots
            <input name="add" type="number" min={1} max={99} defaultValue={requestedAdd >= 1 ? requestedAdd : 10} className="mt-1 h-11 w-24 rounded-xl border border-line bg-card px-3" />
          </label>
          <button className="h-11 rounded-full border border-line bg-card px-4 text-sm">Compare</button>
        </form>
      ) : null}
      {expansionCopy ? <p className="mt-3 text-sm leading-6">{expansionCopy}</p> : null}
      {noticeText ? <p className="mt-3 text-sm leading-6 text-muted">{noticeText}</p> : null}
      <BuyBundlePicker rows={rows} initialId={initialId} />
    </main>
  );
}
