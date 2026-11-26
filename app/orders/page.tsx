import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AccountFrame } from "@/components/account-frame";
import { BuyerFollowing } from "@/components/buyer-following";
import { BuyerOrders } from "@/components/buyer-orders";
import { BuyerSaved } from "@/components/buyer-saved";
import { BuyerSection } from "@/components/buyer-section";
import { requireUser } from "@/lib/auth";
import { claimBuyerOrders, getInteraction, listBrowseHistory, listBuyerInteractions, listBuyerOrders, listBuyerQuotes, listFavorites, listFollowing, listUserReviews, openInteraction } from "@/lib/db";
import { formatDate, formatMoney, orderHeading } from "@/lib/format";
import { fulfillmentDone, orderStage } from "@/lib/order-flow";
import { storedUpload } from "@/lib/uploads";

const SECTIONS = [
  ["orders", "Orders"],
  ["saved", "Saved"],
  ["following", "Following"],
  ["history", "Browse history"],
] as const;

type BuyerSectionId = (typeof SECTIONS)[number][0];

const TITLES: Record<BuyerSectionId, string> = {
  orders: "My purchases & quote requests",
  saved: "Saved",
  following: "Following",
  history: "Browse history",
};

function readSection(value: string | string[] | undefined): BuyerSectionId {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "saved" || raw === "following" || raw === "history") return raw;
  return "orders";
}

async function OrdersScreen({ section }: { section: BuyerSectionId }) {
  const user = await requireUser();
  return (
    <AccountFrame title={TITLES[section]}>
      <nav className="mt-8 flex gap-4 border-b border-line text-sm">
        {SECTIONS.map(([id, label]) => (
          <Link
            key={id}
            href={id === "orders" ? "/orders" : `/orders?section=${id}`}
            scroll={false}
            aria-current={section === id ? "page" : undefined}
            className={`inline-flex items-center border-b-2 pb-2 ${section === id ? "border-forest font-medium text-forest" : "border-transparent text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {section === "orders" ? <Purchases userId={user.id} email={user.email} /> : null}
      {section === "saved" ? <Saved userId={user.id} /> : null}
      {section === "following" ? <Following userId={user.id} /> : null}
      {section === "history" ? <History userId={user.id} /> : null}
    </AccountFrame>
  );
}

async function Purchases({ userId, email }: { userId: string; email: string }) {
  claimBuyerOrders(userId, email);
  const orders = listBuyerOrders(userId, email);
  const quotes = listBuyerQuotes(email);
  const interactions = listBuyerInteractions(userId, email);
  const bySource = new Map(interactions.map((item) => [item.sourceId, item]));
  const reviewed = new Set(listUserReviews(userId).map((review) => review.interactionId));
  const ensure = (sourceId: string, kind: "order" | "quote", productId: string, sellerId: string, buyerEmail: string) => {
    const existing = bySource.get(sourceId);
    if (existing) return existing;
    const opened = openInteraction({ kind, sourceId, productId, sellerId, buyerId: userId, buyerEmail });
    const created = getInteraction(opened.id);
    if (created) bySource.set(sourceId, created);
    return created;
  };
  return (
    <BuyerOrders
      orders={orders.map((order) => {
        const interaction = ensure(order.id, "order", order.productId, order.sellerId, order.email || email);
        const stage = orderStage(order);
        const canReview = fulfillmentDone(order.fulfillmentState);
        const allowConfirm = canReview && !order.buyerReceivedAt;
        return {
          id: order.id,
          publicRef: order.publicRef,
          heading: orderHeading(order),
          quantity: order.quantity,
          fulfillment: order.fulfillment,
          amount: formatMoney(order.amountCents, order.currency),
          amountCents: order.amountCents,
          stage,
          when: formatDate(order.createdAt),
          createdAt: order.createdAt,
          fileSent: order.fulfillment === "digital" && stage === "File sent",
          needsYou: allowConfirm || (canReview && interaction ? !reviewed.has(interaction.id) : false),
          interaction: interaction
            ? {
                id: interaction.id,
                publicRef: interaction.publicRef,
                buyerConfirmedAt: interaction.buyerConfirmedAt,
                sellerConfirmedAt: interaction.sellerConfirmedAt,
              }
            : null,
          allowConfirm,
          confirmLabel: order.fulfillment === "digital" ? "Confirm file access" : "Confirm item received",
          reviewTitle: orderHeading(order),
          reviewed: interaction ? reviewed.has(interaction.id) : false,
          canReview,
        };
      })}
      quotes={quotes.map((quote) => ({
        id: quote.id,
        title: quote.productTitle,
        quantity: quote.quantity,
        when: formatDate(quote.createdAt),
        createdAt: quote.createdAt,
        replied: Boolean(quote.offerSentAt),
        closed: quote.status === "closed",
      }))}
    />
  );
}

async function Saved({ userId }: { userId: string }) {
  const saved = listFavorites(userId);
  return (
    <BuyerSaved
      items={saved.map((product) => ({
        id: product.id,
        title: product.title,
        seller: product.displayName,
        price: product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request",
        priceCents: product.priceCents,
        href: `/${product.publicId}/${product.slug}`,
        image: product.images[0] ?? "",
        unoptimized: Boolean(product.images[0] && storedUpload(product.images[0])),
        savedAt: product.savedAt,
        cta: product.cta,
      }))}
    />
  );
}

async function Following({ userId }: { userId: string }) {
  return <BuyerFollowing sellers={listFollowing(userId)} />;
}

async function History({ userId }: { userId: string }) {
  const history = listBrowseHistory(userId);
  return (
    <BuyerSection title="Browse history" center={history.length === 0}>
      {history.length === 0 ? (
        <p className="text-sm text-muted">Twigs you open will show up here.</p>
      ) : (
        <ul className="space-y-3">
          {history.map(({ product, seenAt }) => (
            <li key={product.id}>
              <Link href={`/${product.publicId}/${product.slug}`} className="flex gap-4 rounded-2xl border border-line bg-card p-4">
                <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                  {product.images[0] ? <Image src={product.images[0]} alt="" fill unoptimized={storedUpload(product.images[0])} className="object-cover" sizes="80px" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-2xl">{product.title}</span>
                  <span className="block text-sm text-muted">{product.displayName}</span>
                  <span className="mt-1 block">{product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}</span>
                  <span className="block text-sm text-muted">{formatDate(seenAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BuyerSection>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const section = readSection((await searchParams).section);
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <OrdersScreen section={section} />
    </Suspense>
  );
}

export const metadata = { title: "My purchases & quote requests", robots: { index: false, follow: false } };
