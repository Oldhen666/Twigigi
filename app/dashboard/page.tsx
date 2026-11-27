import Link from "next/link";
import { Suspense } from "react";
import { SellerOrders } from "@/components/seller-orders";
import { SellerQuotes } from "@/components/seller-quotes";
import { SellerTwigs } from "@/components/seller-twigs";
import { TwigCard } from "@/components/twig-card";
import { getImpersonation, requireSeller } from "@/lib/auth";
import { formatListingFee, listingFeeCurrency, platformFee } from "@/lib/billing";
import { activePlanQuote } from "@/lib/digital-plans";
import { activeBuyQuote } from "@/lib/buy-plans";
import { legacyDigitalBilling, listOrders, listQuotes, listSellerNotices, productHasActivity, readBuySubscription, readDigitalSubscription, sellerProducts } from "@/lib/db";
import type { OrderRecord, Product } from "@/lib/types";
import { formatDate, formatMoney, isTwigLive, orderHeading, productUrl, readCta } from "@/lib/format";
import { orderStage, sellerAttention, sellerBulkActions } from "@/lib/order-flow";
import { QUOTE_FEE_CURRENCY, QUOTE_LISTING_CENTS } from "@/lib/quote-followup";

type Offer = "buy" | "file" | "quote";

const OFFERS: { id: Offer; title: string; create: string }[] = [
  { id: "buy", title: "Buy Now", create: "Create a buy now twig" },
  { id: "file", title: "Digital File", create: "Create a digital file" },
  { id: "quote", title: "Get a Quote", create: "Create a quote listing" },
];

async function DashboardBody({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = readCta(typeof params.cta === "string" ? params.cta : undefined);
  const offer: Offer | null = requested === "buy" || requested === "file" || requested === "quote" ? requested : null;
  const section = readSection(typeof params.section === "string" ? params.section : undefined, offer);
  const user = await requireSeller();
  const acting = Boolean(await getImpersonation());
  const products = sellerProducts(user.id);
  const orders = listOrders(user.id);
  const quotes = listQuotes(user.id);
  const notices = listSellerNotices(user.id);
  const scopedProducts = offer ? products.filter((product) => product.cta === offer) : [];
  const scopedIds = new Set(scopedProducts.map((product) => product.id));
  const scopedOrders = offer ? orders.filter((order) => scopedIds.has(order.productId)) : [];
  const scopedQuotes = offer ? quotes.filter((quote) => scopedIds.has(quote.productId)) : [];
  const quoteAttention = scopedQuotes.filter((quote) => quote.status === "new").length;
  const attention = scopedOrders.filter((order) => sellerAttention(order)).length;
  const totalOrders = scopedOrders.filter((order) => order.status !== "canceled" && order.reviewState !== "declined").length;
  const live = scopedProducts.filter((product) => isTwigLive(product)).length;
  const drafts = scopedProducts.filter((product) => product.status === "draft").length;
  const share = scopedProducts.find((product) => isTwigLive(product));
  const shareUrl = share ? productUrl(user.publicId, share.slug) : "";
  const fresh = scopedProducts.length === 0;
  const waiting = scopedProducts.length > 0 && totalOrders === 0;
  const views = scopedProducts.reduce((sum, product) => sum + product.viewCount, 0);
  const sales = salesOf(scopedOrders);
  const digitalSubscription = readDigitalSubscription(user.id);
  const digitalPlan = activePlanQuote(digitalSubscription);
  const publishedFiles = products.filter((product) => product.cta === "file" && product.status === "published" && !product.feeExempt).length;
  const digitalLegacy = legacyDigitalBilling(user.id);
  const buySubscription = readBuySubscription(user.id);
  const buyPlan = activeBuyQuote(buySubscription);
  const publishedBuy = products.filter((product) => product.cta === "buy" && product.status === "published" && !product.feeExempt).length;
  const selected = OFFERS.find((item) => item.id === offer);

  return (
    <main className="page-frame pb-16">
      <div className="mt-6">
        <h1 className="font-serif text-4xl">Overview</h1>
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

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {OFFERS.map((item) => {
          const count = products.filter((product) => product.cta === item.id).length;
          const current = item.id === offer;
          const waitingCount = categoryNotices({
            offer: item.id,
            products,
            orders,
            quotes,
            buyGrace: Boolean(buyPlan && buySubscription?.status === "grace"),
            buyOver: Boolean(buyPlan && buyPlan.listingLimit != null && publishedBuy > buyPlan.listingLimit),
            fileGrace: Boolean(digitalPlan && digitalSubscription?.status === "grace"),
            fileOver: Boolean(digitalPlan && digitalPlan.listingLimit != null && publishedFiles > digitalPlan.listingLimit),
          });
          const brief = categoryBrief({
            offer: item.id,
            products,
            orders,
            quotes,
            buyPlan,
            digitalPlan,
            digitalLegacy: digitalLegacy.fileListingsWithListingBills > 0,
          });
          return (
            <article
              key={item.id}
              className={`relative flex h-full flex-col rounded-[28px] bg-card p-5 ${current ? "border-[3px] border-forest" : "border border-line"}`}
            >
              {waitingCount > 0 && !current ? (
                <span className="absolute -right-1.5 -top-1.5 grid min-h-6 min-w-6 place-items-center rounded-full bg-clay px-1.5 text-xs font-medium text-card">
                  {waitingCount > 99 ? "99+" : waitingCount}
                  <span className="sr-only">{waitingCount === 1 ? "1 item needs you" : `${waitingCount} items need you`}</span>
                </span>
              ) : null}
              <Link href={`/dashboard?cta=${item.id}`} aria-current={current ? "page" : undefined} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                <p className="text-xl font-medium text-forest">{item.title}</p>
                <p className="mt-2 text-sm text-muted">{count === 1 ? "1 listing" : `${count} listings`}</p>
                <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">{brief.totalLabel}</dt>
                    <dd className="font-medium">{brief.total}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Last 7 days</dt>
                    <dd className="font-medium">{brief.recent}</dd>
                  </div>
                </dl>
              </Link>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm text-muted">Plan</p>
                <p className="mt-1 text-sm font-medium">{brief.planName}</p>
                {brief.planDetail ? <p className="mt-1 text-sm text-muted">{brief.planDetail}</p> : null}
              </div>
            </article>
          );
        })}
      </div>

      {selected ? (
        <>
          {offer === "file" || offer === "buy" ? (
            <section className="mt-6 rounded-3xl bg-card px-4 sm:px-5">
              <h2 className="pt-4 font-serif text-2xl">Your current plan</h2>
              <div className="mt-1 divide-y divide-line">
                {offer === "file" ? (
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
                ) : (
                  <PlanRow
                    kind="Buy Now"
                    status={buyPlan ? buyPlan.extraSlots > 0 && buyPlan.listingLimit != null ? `${buyPlan.plan.name} · ${buyPlan.listingLimit} listings` : buyPlan.plan.name : "Pay per listing"}
                    detail={buyPlan ? `${platformFee(buyPlan.monthlyCents, "CAD")} / month` : buyListingRate(products)}
                    usage={publishedUsage(publishedBuy, buyPlan?.listingLimit)}
                    href="/dashboard/buy"
                    action={buyPlan ? "Manage bundle" : "Upgrade your bundle"}
                    upgrade={!buyPlan}
                    note={buyPlan && buySubscription?.status === "grace"
                      ? "Payment needs attention."
                      : buyPlan && buyPlan.listingLimit != null && publishedBuy > buyPlan.listingLimit
                        ? "Over the listing limit."
                        : ""}
                  />
                )}
              </div>
            </section>
          ) : null}

          <nav className="mt-8 flex gap-4 border-b border-line text-sm">
            {(selected.id === "quote"
              ? [["quotes", "Quotes", quoteAttention], ["twigs", "Twigs", 0]] as const
              : [["orders", "Orders", attention], ["twigs", "Twigs", 0]] as const).map(([id, label, count]) => (
              <Link
                key={id}
                href={`/dashboard?cta=${selected.id}&section=${id}`}
                scroll={false}
                aria-current={section === id ? "page" : undefined}
                className={`inline-flex items-center border-b-2 pb-2 ${section === id ? "border-forest font-medium text-forest" : "border-transparent text-muted"}`}
              >
                {label}
                <CountDot count={count} />
              </Link>
            ))}
          </nav>

          {section === "orders" ? (
            fresh || waiting ? (
              <section className="mt-6 max-w-xl rounded-3xl border border-line bg-card p-6">
                <h2 className="font-serif text-2xl">No orders yet</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{fresh ? "Create a Twig, then share the link." : "You have a Twig and no orders yet. Send the link to a buyer."}</p>
                {shareUrl ? <p className="mt-3 break-all text-sm font-medium">{shareUrl}</p> : null}
              </section>
            ) : (
              <>
                <section className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-line bg-card px-4 py-4">
                    <p className="text-sm text-muted">Total orders</p>
                    <p className="mt-2 font-serif text-3xl">{totalOrders}</p>
                    <p className="mt-1 text-xs text-muted">All time</p>
                  </div>
                  <div className="rounded-3xl border border-line bg-card px-4 py-4">
                    <p className="text-sm text-muted">Confirmed paid</p>
                    <p className="mt-2 font-serif text-3xl">{moneyOf(sales, "paid")}</p>
                    <p className="mt-1 text-xs text-muted">Seller-reported</p>
                  </div>
                  <div className="rounded-3xl border border-line bg-card px-4 py-4">
                    <p className="text-sm text-muted">Awaiting payment</p>
                    <p className="mt-2 font-serif text-3xl">{moneyOf(sales, "awaiting")}</p>
                    <p className="mt-1 text-xs text-muted">Unpaid order value</p>
                  </div>
                  <Link href="/dashboard/views" className="rounded-3xl border border-line bg-card px-4 py-4">
                    <p className="text-sm text-muted">Listing views</p>
                    <p className="mt-2 font-serif text-3xl">{views}</p>
                    <p className="mt-1 text-xs text-muted">All time</p>
                  </Link>
                </section>
                <section className={`mt-4 rounded-3xl border px-4 py-4 ${attention > 0 ? "border-clay/30 bg-clay/10" : "border-line bg-card"}`}>
                  <p className="flex items-center font-medium">
                    {attention === 0 ? "Nothing needs you right now." : attention === 1 ? "1 order needs you." : `${attention} orders need you.`}
                    <CountDot count={attention} />
                  </p>
                </section>
                <div className="mt-4">
                  <SellerOrders orders={scopedOrders.map((order) => ({
                    id: order.id,
                    publicRef: order.publicRef || order.buyerName,
                    heading: `${orderHeading(order)}${order.lines.length <= 1 && order.variantLabel ? ` · ${order.variantLabel}` : ""}`,
                    buyerName: order.buyerName,
                    amount: formatMoney(order.amountCents, order.currency),
                    amountCents: order.amountCents,
                    stage: orderStage(order),
                    attention: sellerAttention(order),
                    when: formatDate(order.createdAt, order.productLocation),
                    createdAt: order.createdAt,
                    actions: sellerBulkActions(order),
                  }))} />
                </div>
              </>
            )
          ) : null}

          {section === "quotes" ? (
            scopedQuotes.length === 0 ? (
              <section className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
                <h2 className="font-serif text-2xl">No quotes yet</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Requests for these Twigs will be listed here.</p>
              </section>
            ) : (
              <div className="mt-6">
                <SellerQuotes quotes={scopedQuotes.map((quote) => {
                  const code = scopedProducts.find((product) => product.id === quote.productId)?.currency || "CAD";
                  return {
                    id: quote.id,
                    productId: quote.productId,
                    productTitle: quote.productTitle,
                    name: quote.name,
                    email: quote.email,
                    phone: quote.phone,
                    message: quote.message,
                    quantity: quote.quantity,
                    projectDetails: quote.projectDetails,
                    status: quote.status,
                    createdAt: quote.createdAt,
                    submitted: formatDate(quote.createdAt),
                    billable: quote.billable,
                    feeReason: quote.feeReason,
                    offer: quote.offerCents > 0 ? `${quote.offerKind || "quote"} ${formatMoney(quote.offerCents, code)}` : "",
                  };
                })} />
              </div>
            )
          ) : null}

          {section === "twigs" ? (
            fresh ? (
              <section className="mt-6 max-w-xl rounded-3xl border border-dashed border-line bg-card p-6">
                <h2 className="font-serif text-3xl">{selected.create}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Create a Twig, then share the link.</p>
                <Link href={`/dashboard/products/new?cta=${selected.id}`} className="mt-5 inline-flex h-12 items-center rounded-full bg-forest px-5 text-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">{selected.create}</Link>
                {user.billingMethod || acting ? null : (
                  <p className="mt-4 text-sm">
                    <Link href={`/billing?next=${encodeURIComponent(`/dashboard?cta=${selected.id}`)}`} className="font-medium text-forest">Choose how you pay Twigigi fees</Link>
                    <span className="text-muted"> before publishing. This does not connect Stripe for buyers.</span>
                  </p>
                )}
              </section>
            ) : (
              <section className="mt-6">
                <p className="text-sm text-muted">{live} live · {drafts} {drafts === 1 ? "draft" : "drafts"}</p>
                <SellerTwigs
                  items={scopedProducts.map((product) => ({
                    id: product.id,
                    title: product.title,
                    status: product.status,
                    live: isTwigLive(product),
                    updatedAt: product.updatedAt,
                    views: product.viewCount,
                    card: (
                      <TwigCard
                        product={product}
                        publicId={user.publicId}
                        acting={acting}
                        canDelete={product.status === "deactivated" || (product.status === "draft" && !productHasActivity(product.id))}
                        returnTo={`/dashboard?cta=${selected.id}&section=twigs`}
                      />
                    ),
                  }))}
                />
              </section>
            )
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function readSection(value: string | undefined, offer: Offer | null) {
  if (offer === "quote") return value === "twigs" ? "twigs" : "quotes";
  return value === "twigs" ? "twigs" : "orders";
}

function CountDot({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="ml-1 inline-grid min-h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[11px] font-medium leading-none text-card">
      {count > 99 ? "99+" : count}
      <span className="sr-only">{count === 1 ? "1 item needs you" : `${count} items need you`}</span>
    </span>
  );
}

function publishedUsage(count: number, limit?: number | null) {
  if (typeof limit === "number") return `${count} of ${limit} published`;
  return count === 1 ? "1 listing" : `${count} listings`;
}

function buyListingRate(products: Product[]) {
  const published = products.filter((product) => product.cta === "buy" && product.status === "published" && !product.feeExempt);
  const currencies = [...new Set(published.map((product) => listingFeeCurrency("buy", product.location)))].sort();
  const amounts = (currencies.length > 0 ? currencies : ["CAD"]).map((currency) => formatListingFee(currency));
  return `${amounts.join(" or ")} every 30 days`;
}

function PlanRow({
  kind,
  status,
  detail = "",
  usage,
  href,
  action,
  upgrade = false,
  note = "",
}: {
  kind: string;
  status: string;
  detail?: string;
  usage: string;
  href: string;
  action: string;
  upgrade?: boolean;
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
      <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest sm:justify-self-end">
        {upgrade ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-forest" aria-hidden="true">
            <path d="M8 2.2 3.2 7.4h2.9V13h3.8V7.4h2.9L8 2.2Z" fill="currentColor" />
          </svg>
        ) : null}
        {action}
      </Link>
    </div>
  );
}

function categoryBrief(input: {
  offer: Offer;
  products: Product[];
  orders: OrderRecord[];
  quotes: { productId: string; status: string; createdAt: string }[];
  buyPlan: { plan: { name: string }; extraSlots: number; listingLimit: number | null; monthlyCents: number } | null;
  digitalPlan: { plan: { name: string }; copies: number; monthlyCents: number } | null;
  digitalLegacy: boolean;
}) {
  const ids = new Set(input.products.filter((product) => product.cta === input.offer).map((product) => product.id));
  if (input.offer === "quote") {
    const rows = input.quotes.filter((quote) => ids.has(quote.productId));
    const published = input.products.filter((product) => product.cta === "quote" && product.status === "published" && !product.feeExempt).length;
    return {
      totalLabel: "Total quotes",
      total: rows.length,
      recent: rows.filter((quote) => inLast7Days(quote.createdAt)).length,
      planName: published > 0 ? "Quote listing" : "No listing fee yet",
      planDetail: published > 0 ? `${platformFee(QUOTE_LISTING_CENTS, QUOTE_FEE_CURRENCY)} per listing / month` : "",
    };
  }
  const rows = input.orders.filter((order) => ids.has(order.productId) && order.status !== "canceled" && order.reviewState !== "declined");
  const counts = { totalLabel: "Total orders", total: rows.length, recent: rows.filter((order) => inLast7Days(order.createdAt)).length };
  if (input.offer === "file") {
    if (!input.digitalPlan) return { ...counts, planName: input.digitalLegacy ? "Legacy listing" : "No active plan", planDetail: "" };
    const name = input.digitalPlan.copies > 1 ? `${input.digitalPlan.plan.name} × ${input.digitalPlan.copies}` : input.digitalPlan.plan.name;
    return { ...counts, planName: name, planDetail: `${platformFee(input.digitalPlan.monthlyCents, "CAD")}/month` };
  }
  if (!input.buyPlan) return { ...counts, planName: "Pay per listing", planDetail: buyListingRate(input.products) };
  const name = input.buyPlan.extraSlots > 0 && input.buyPlan.listingLimit != null ? `${input.buyPlan.plan.name} · ${input.buyPlan.listingLimit} listings` : input.buyPlan.plan.name;
  return { ...counts, planName: name, planDetail: `${platformFee(input.buyPlan.monthlyCents, "CAD")}/month` };
}

function inLast7Days(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) && Date.now() - time < 7 * 24 * 60 * 60 * 1000;
}

function categoryNotices(input: {
  offer: Offer;
  products: Product[];
  orders: OrderRecord[];
  quotes: { productId: string; status: string }[];
  buyGrace: boolean;
  buyOver: boolean;
  fileGrace: boolean;
  fileOver: boolean;
}) {
  const ids = new Set(input.products.filter((product) => product.cta === input.offer).map((product) => product.id));
  const orders = input.orders.filter((order) => ids.has(order.productId) && sellerAttention(order)).length;
  if (input.offer === "buy") return orders + Number(input.buyGrace) + Number(input.buyOver);
  if (input.offer === "file") return orders + Number(input.fileGrace) + Number(input.fileOver);
  const freshQuotes = input.quotes.filter((quote) => quote.status === "new" && ids.has(quote.productId)).length;
  return orders + freshQuotes;
}

function salesOf(orders: OrderRecord[]) {
  const totals = new Map<string, { currency: string; paidCents: number; awaitingCents: number }>();
  for (const order of orders) {
    if (order.status === "canceled") continue;
    const amount = order.totalCents > 0 ? order.totalCents : order.amountCents;
    const currency = order.currency || "CAD";
    const row = totals.get(currency) ?? { currency, paidCents: 0, awaitingCents: 0 };
    const paid = order.paymentStatus === "paid" || order.status === "paid" || order.status === "fulfilled";
    if (paid) row.paidCents += amount;
    else row.awaitingCents += amount;
    totals.set(currency, row);
  }
  return [...totals.values()].filter((row) => row.paidCents > 0 || row.awaitingCents > 0);
}

function moneyOf(rows: { currency: string; paidCents: number; awaitingCents: number }[], key: "paid" | "awaiting") {
  if (rows.length === 0) return formatMoney(0);
  return rows.map((row) => formatMoney(key === "paid" ? row.paidCents : row.awaitingCents, row.currency)).join(" · ");
}

export const metadata = { title: "Selling", robots: { index: false, follow: false } };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-5 text-muted">Loading…</p>}>
      <DashboardBody searchParams={searchParams} />
    </Suspense>
  );
}
