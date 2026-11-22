import Link from "next/link";
import { Suspense } from "react";
import { TwigCard } from "@/components/twig-card";
import { getImpersonation, requireSeller } from "@/lib/auth";
import { formatListingFee, listingFeeCurrency, platformFee } from "@/lib/billing";
import { activePlanQuote } from "@/lib/digital-plans";
import { activeBuyQuote } from "@/lib/buy-plans";
import { legacyDigitalBilling, listOrders, listSellerNotices, productHasActivity, readBuySubscription, readDigitalSubscription, sellerProducts, sellerSales, sellerStats } from "@/lib/db";
import type { Product } from "@/lib/types";
import { formatMoney, isTwigLive, productUrl } from "@/lib/format";
import { sellerAttention } from "@/lib/order-flow";

async function DashboardBody() {
  const user = await requireSeller();
  const acting = Boolean(await getImpersonation());
  const stats = sellerStats(user.id);
  const sales = sellerSales(user.id);
  const products = sellerProducts(user.id);
  const orders = listOrders(user.id);
  const attention = orders.filter((order) => sellerAttention(order)).length;
  const totalOrders = orders.filter((order) => order.status !== "canceled" && order.reviewState !== "declined").length;
  const live = products.filter((product) => isTwigLive(product)).length;
  const drafts = products.filter((product) => product.status === "draft").length;
  const preview = products.slice(0, 3);
  const share = products.find((product) => isTwigLive(product));
  const shareUrl = share ? productUrl(user.publicId, share.slug) : "";
  const fresh = products.length === 0;
  const waiting = products.length > 0 && totalOrders === 0;
  const notices = listSellerNotices(user.id);
  const digitalSubscription = readDigitalSubscription(user.id);
  const digitalPlan = activePlanQuote(digitalSubscription);
  const publishedFiles = products.filter((product) => product.cta === "file" && product.status === "published").length;
  const digitalLegacy = legacyDigitalBilling(user.id);
  const buySubscription = readBuySubscription(user.id);
  const buyPlan = activeBuyQuote(buySubscription);
  const publishedBuy = products.filter((product) => product.cta === "buy" && product.status === "published").length;

  return (
    <main className="page-frame pb-16">
      <div className="mt-6">
        <h1 className="font-serif text-4xl">Overview</h1>
        {fresh ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Create a Twig, then share the link.</p> : null}
      </div>
      {notices.length > 0 ? (
        <section className="mt-6 max-w-xl space-y-3">
          {notices.map((notice) => (
            <article key={notice.id} className="rounded-3xl border border-line bg-card p-4 text-sm leading-6">
              <p className="whitespace-pre-wrap">{notice.body}</p>
              <p className="mt-2"><Link href="/legal/copyright-appeal" className="text-forest">Request a review</Link></p>
            </article>
          ))}
        </section>
      ) : null}

      {fresh ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
          <h2 className="font-serif text-3xl">Create your first Twig</h2>
          <ol className="mt-4 space-y-2 text-sm leading-6 text-muted">
            <li>1. Create the Twig.</li>
            <li>2. Add the payment method that fits that Twig. Stripe is only for digital files.</li>
            <li>3. Share your link.</li>
          </ol>
          <Link href="/start" className="mt-5 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">Create a Twig</Link>
          {user.billingMethod || acting ? null : (
            <p className="mt-4 text-sm">
              <Link href="/billing?next=/dashboard" className="font-medium text-forest">Choose how you pay Twigigi fees</Link>
              <span className="text-muted"> before publishing. This does not connect Stripe for buyers.</span>
            </p>
          )}
        </section>
      ) : null}

      {waiting ? (
        <section className="mt-6 max-w-xl rounded-3xl border border-line bg-card p-6">
          <h2 className="font-serif text-2xl">Share your Twig</h2>
          <p className="mt-2 text-sm leading-6 text-muted">You have a Twig and no orders yet. Send the link to a buyer.</p>
          {shareUrl ? <p className="mt-3 break-all text-sm font-medium">{shareUrl}</p> : <Link href="/dashboard/twigs" className="mt-4 inline-flex text-sm font-medium text-forest">View Twigs</Link>}
        </section>
      ) : null}

      {!fresh && !waiting ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard/orders" className="rounded-3xl border border-line bg-card px-4 py-4">
              <p className="text-sm text-muted">Total orders</p>
              <p className="mt-2 font-serif text-3xl">{totalOrders}</p>
              <p className="mt-1 text-xs text-muted">All time</p>
            </Link>
            <div className="rounded-3xl border border-line bg-card px-4 py-4">
              <p className="text-sm text-muted">Confirmed paid</p>
              <p className="mt-2 font-serif text-3xl">{moneyOf(sales, "paid")}</p>
              <p className="mt-1 text-xs text-muted">Seller-reported</p>
            </div>
            <Link href="/dashboard/orders" className="rounded-3xl border border-line bg-card px-4 py-4">
              <p className="text-sm text-muted">Awaiting payment</p>
              <p className="mt-2 font-serif text-3xl">{moneyOf(sales, "awaiting")}</p>
              <p className="mt-1 text-xs text-muted">Unpaid order value</p>
            </Link>
            <Link href="/dashboard/views" className="rounded-3xl border border-line bg-card px-4 py-4">
              <p className="text-sm text-muted">Listing views</p>
              <p className="mt-2 font-serif text-3xl">{stats.views}</p>
              <p className="mt-1 text-xs text-muted">All time</p>
            </Link>
          </section>
          <section className={`mt-4 rounded-3xl border px-4 py-4 ${attention > 0 ? "border-clay/30 bg-clay/10" : "border-line bg-card"}`}>
            <p className="font-medium">{attention === 0 ? "Nothing needs you right now." : attention === 1 ? "1 order needs you." : `${attention} orders need you.`}</p>
            <Link href="/dashboard/orders" className="mt-3 inline-flex h-11 items-center rounded-full border border-line bg-white px-4 text-sm">View orders</Link>
          </section>
        </>
      ) : null}

      <section className="mt-6 rounded-3xl border border-line bg-card px-4 sm:px-5">
        <h2 className="pt-4 font-serif text-2xl">Listing plans</h2>
        <div className="mt-1 divide-y divide-line">
          <PlanRow
            kind="Digital File"
            status={digitalPlan ? digitalPlan.copies > 1 ? `${digitalPlan.plan.name} × ${digitalPlan.copies}` : digitalPlan.plan.name : "No active plan"}
            usage={publishedUsage(publishedFiles, digitalPlan?.listingLimit)}
            href="/dashboard/digital"
            action={digitalPlan ? "Manage plan" : "View plans"}
            note={digitalPlan
              ? digitalSubscription?.status === "grace"
                ? "Payment needs attention."
                : digitalPlan.listingLimit != null && publishedFiles > digitalPlan.listingLimit
                  ? "Over the listing limit."
                  : ""
              : digitalLegacy.fileListingsWithListingBills > 0
                ? "Legacy listing"
                : ""}
          />
          <PlanRow
            kind="Buy Now"
            status={buyPlan ? buyPlan.listingLimit == null ? "Unlimited bundle" : `${buyPlan.listingLimit}-listing bundle` : "Pay per listing"}
            detail={buyPlan ? `${platformFee(buyPlan.monthlyCents, "CAD")} / month` : buyListingRate(products)}
            usage={publishedUsage(publishedBuy, buyPlan?.listingLimit)}
            href="/dashboard/buy"
            action={buyPlan ? "Manage bundle" : "View bundles"}
            note={buyPlan && buySubscription?.status === "grace"
              ? "Payment needs attention."
              : buyPlan && buyPlan.listingLimit != null && publishedBuy > buyPlan.listingLimit
                ? "Over the listing limit."
                : ""}
          />
        </div>
      </section>

      {fresh ? null : (
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Most recent Twigs</h2>
            <p className="mt-1 text-sm text-muted">{live} live · {drafts} {drafts === 1 ? "draft" : "drafts"}</p>
          </div>
          <Link href="/dashboard/twigs" className="text-sm font-medium text-forest">View all</Link>
        </div>
        {preview.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-line bg-card p-6">
            <p className="font-serif text-2xl">You have something to sell.</p>
            <p className="mt-2 text-sm text-muted">Make the Twig, then share the link.</p>
            <Link href="/start" className="mt-4 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card">Create a Twig</Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {preview.map((product) => (
              <TwigCard
                key={product.id}
                product={product}
                publicId={user.publicId}
                acting={acting}
                canDelete={product.status === "deactivated" || (product.status === "draft" && !productHasActivity(product.id))}
                returnTo="/dashboard"
              />
            ))}
          </div>
        )}
      </section>
      )}
    </main>
  );
}

function publishedUsage(count: number, limit?: number | null) {
  if (typeof limit === "number") return `${count} of ${limit} published`;
  return count === 1 ? "1 listing" : `${count} listings`;
}

function buyListingRate(products: Product[]) {
  const published = products.filter((product) => product.cta === "buy" && product.status === "published");
  const currencies = [...new Set(published.map((product) => listingFeeCurrency("buy", product.location)))].sort();
  const amounts = (currencies.length > 0 ? currencies : ["CAD"]).map((currency) => formatListingFee(currency));
  return `${amounts.join(" or ")} per listing / 30 days`;
}

function PlanRow({
  kind,
  status,
  detail = "",
  usage,
  href,
  action,
  note = "",
}: {
  kind: string;
  status: string;
  detail?: string;
  usage: string;
  href: string;
  action: string;
  note?: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 py-4 sm:grid-cols-[minmax(7.5rem,0.8fr)_minmax(0,1.5fr)_minmax(0,10rem)_auto] sm:items-center sm:gap-4">
      <p className="font-medium">{kind}</p>
      <div className="min-w-0">
        <p className="break-words">{status}</p>
        {detail ? <p className="break-words text-sm text-muted">{detail}</p> : null}
        {note ? <p className="break-words text-sm text-muted">{note}</p> : null}
      </div>
      <p className="text-sm text-muted">{usage}</p>
      <Link href={href} className="text-sm font-medium text-forest sm:justify-self-end">{action}</Link>
    </div>
  );
}

function moneyOf(rows: { currency: string; paidCents: number; awaitingCents: number }[], key: "paid" | "awaiting") {
  if (rows.length === 0) return formatMoney(0);
  return rows.map((row) => formatMoney(key === "paid" ? row.paidCents : row.awaitingCents, row.currency)).join(" · ");
}

export const metadata = { title: "Selling", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading…</p>}>
      <DashboardBody />
    </Suspense>
  );
}
