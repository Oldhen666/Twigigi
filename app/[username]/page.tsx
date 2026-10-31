import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Stars } from "@/components/stars";
import { BackButton } from "@/components/back-button";
import { SellerListings } from "@/components/seller-listings";
import { listingStillPaid } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { UsernameForm } from "@/components/username-form";
import { filterLiveTwigs, getPublicSeller, staticProductParams } from "@/lib/catalog";
import { sellerPath } from "@/lib/seller-route";
import { sellerProducts } from "@/lib/db";
import { addDays, ctaCopy, DEACTIVATION_GRACE_DAYS, formatBillingDate, formatMoney, isTwigLive, nextBillingDate } from "@/lib/format";
import type { Product } from "@/lib/types";

export function generateStaticParams() {
  const names = new Set(staticProductParams().map((item) => item.username));
  return [...names].map((username) => ({ username }));
}

async function SellerPage({ params }: { params: Promise<{ username: string }> }) {
  await connection();
  const { username } = await params;
  const publicId = sellerPath(username);
  if (!publicId) notFound();
  const seller = await getPublicSeller(publicId);
  if (!seller) notFound();
  const account = await getCurrentUser();
  const owner = Boolean(account && account.publicId === seller.publicId);
  const products = account && owner
    ? sellerProducts(account.id).filter((product) => product.status === "deactivated" || isTwigLive(product))
    : await filterLiveTwigs(seller.products);
  const pagePath = `/${seller.publicId}`;
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <Logo />
      <div className="mt-3">
        <BackButton />
      </div>
      <p className="mt-10 text-sm text-muted">Twigger</p>
      <h1 className="mt-2 font-serif text-5xl">{seller.displayName}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
        {owner ? <UsernameForm username={seller.username} next={pagePath} /> : <span>{seller.username}</span>}
        {seller.ratingCount > 0 && seller.ratingAverage != null ? (
          <span className="inline-flex items-center gap-1 text-forest">
            <Stars value={seller.ratingAverage} />
            <span className="font-medium text-ink">{seller.ratingAverage.toFixed(1)}</span>
          </span>
        ) : null}
      </div>
      {products.length === 0 ? (
        <p className="mt-6 text-muted">Nothing is published yet.</p>
      ) : (
        <SellerListings
          username={seller.publicId}
          listings={products.map((product) => ({
            slug: product.slug,
            title: product.title,
            location: product.location,
            priceLabel: product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request",
            ctaLabel: ctaCopy(product.cta).label,
            image: product.images[0] ?? "",
            inactive: product.status === "deactivated",
            editHref: owner ? `/dashboard/products/${product.id}` : "",
            manage: owner ? manageListing(product, pagePath) : undefined,
            categoryKind: product.categoryKind,
            categoryGroup: product.categoryGroup,
            category: product.category,
          }))}
        />
      )}
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-muted">Loading…</p>}>
      <SellerPage params={params} />
    </Suspense>
  );
}

function manageListing(product: Product, next: string) {
  const ending = isTwigLive(product) && Boolean(product.deactivatesAt);
  const anchor = product.status === "deactivated" && product.deactivatedAt ? product.deactivatedAt : product.deactivatesAt || nextBillingDate();
  return {
    productId: product.id,
    mode: product.status === "deactivated" ? ("deactivated" as const) : ending ? ("ending" as const) : ("live" as const),
    endsLabel: formatBillingDate(product.deactivatesAt || nextBillingDate()),
    deleteLabel: formatBillingDate(addDays(anchor, DEACTIVATION_GRACE_DAYS), true),
    stillPaid: listingStillPaid(product),
    next,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const publicId = sellerPath(username);
  if (!publicId) return { title: "Seller" };
  const seller = await getPublicSeller(publicId);
  if (!seller) return { title: "Seller" };
  return {
    title: seller.displayName,
    description: `Twigs from ${seller.displayName}.`,
  };
}
