import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { toggleFollowSeller } from "@/lib/actions";
import { Logo } from "@/components/logo";
import { BackButton } from "@/components/back-button";
import { CopyText } from "@/components/copy-text";
import { SellerBio } from "@/components/seller-bio";
import { SellerListings } from "@/components/seller-listings";
import { listingStillPaid } from "@/lib/billing";
import { getCurrentUser, getImpersonation } from "@/lib/auth";
import { UsernameForm } from "@/components/username-form";
import { filterLiveTwigs, getPublicSeller, staticProductParams } from "@/lib/catalog";
import { sellerPath } from "@/lib/seller-route";
import { findUserById, findUserByUsername, followerCount, isFollowing, sellerProducts } from "@/lib/db";
import { addDays, ctaCopy, DEACTIVATION_GRACE_DAYS, formatBillingDate, formatMoney, isTwigLive, nextBillingDate } from "@/lib/format";
import { PROVINCES } from "@/lib/places";
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
  const acting = Boolean(await getImpersonation());
  const owner = Boolean(account && account.publicId === seller.publicId);
  const products = account && owner
    ? sellerProducts(account.id).filter((product) => product.status === "deactivated" || isTwigLive(product))
    : await filterLiveTwigs(seller.products);
  const pagePath = `/${seller.publicId}`;
  const sellerId = findUserByUsername(seller.publicId);
  const profile = sellerId ? findUserById(sellerId) : null;
  const followers = sellerId ? followerCount(sellerId) : 0;
  const following = Boolean(account && sellerId && isFollowing(account.id, sellerId));
  const place = sellerLocation(products.map((product) => product.location));
  const listingLabel = products.length === 1 ? "1 listing" : `${products.length} listings`;
  const followerLabel = followers === 1 ? "1 follower" : `${followers} followers`;
  const reviewLabel = seller.ratingCount === 1 ? "1 review" : `${seller.ratingCount} reviews`;
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <Logo />
        <p className="text-sm text-muted">Seller profile</p>
      </header>
      <div className="mt-3">
        <BackButton />
      </div>
      <section className="mt-6 rounded-3xl border border-line bg-card p-4 sm:p-5">
        <div className="flex gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#e7efe6] text-forest" aria-hidden>
            <PersonIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-semibold">{seller.displayName}</h1>
              {owner ? null : account ? (
                <form action={toggleFollowSeller}>
                  <input type="hidden" name="seller" value={seller.publicId} />
                  <input type="hidden" name="next" value={pagePath} />
                  <button className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 text-xs font-medium text-forest">
                    {following ? "Following" : "Follow"}
                  </button>
                </form>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(pagePath)}`} className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 text-xs font-medium text-forest">
                  Follow
                </Link>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {seller.ratingCount > 0 && seller.ratingAverage != null ? (
                <span className="inline-flex items-center gap-1">
                  <StarIcon />
                  <span className="font-medium text-ink">{seller.ratingAverage.toFixed(1)}</span>
                  <span>({reviewLabel})</span>
                </span>
              ) : (
                <span>No reviews yet</span>
              )}
              {place ? <span>{place}</span> : null}
            </p>
            <p className="mt-1 text-sm text-muted">{listingLabel} · {followerLabel}</p>
            <p className="mt-1 text-sm text-muted">
              {owner && account ? <UsernameForm username={account.username} next={pagePath} /> : seller.username}
            </p>
          </div>
        </div>
        {owner ? <SellerBio bio={profile?.bio ?? ""} next={pagePath} /> : profile?.bio ? <p className="mt-3 text-sm leading-6 text-muted">{profile.bio}</p> : null}
        <CopyText
          value={pagePath}
          label="Copy profile link"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-white text-sm text-ink"
        />
      </section>
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
            manage: owner ? manageListing(product, pagePath, acting) : undefined,
            categoryKind: product.categoryKind || (product.cta === "buy" || product.cta === "file" ? "product" : "service"),
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

function sellerLocation(locations: string[]) {
  const counts = new Map<string, number>();
  for (const raw of locations) {
    const label = placeLabel(raw);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

function placeLabel(value: string) {
  const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[parts.length - 1] ?? "";
  const body = /^(ca|us|canada|united states|usa)$/i.test(last) ? parts.slice(0, -1) : parts;
  if (body.length === 0) return "";
  if (body.length === 1) return body[0] ?? "";
  const region = body[body.length - 1] ?? "";
  const name = PROVINCES.CA[region.toUpperCase()] || PROVINCES.US[region.toUpperCase()] || region;
  return `${body.slice(0, -1).join(", ")}, ${name}`;
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden className="text-forest">
      <path d="M10 1.8 12.4 7l5.6.5-4.2 3.7 1.3 5.5L10 13.8 4.9 16.7l1.3-5.5L2 7.5 7.6 7 10 1.8Z" fill="currentColor" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19.2c1.2-3 3.5-4.4 6.5-4.4s5.3 1.4 6.5 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function manageListing(product: Product, next: string, waiveFee: boolean) {
  const ending = isTwigLive(product) && Boolean(product.deactivatesAt);
  const anchor = product.status === "deactivated" && product.deactivatedAt ? product.deactivatedAt : product.deactivatesAt || nextBillingDate();
  return {
    productId: product.id,
    mode: product.status === "deactivated" ? ("deactivated" as const) : ending ? ("ending" as const) : ("live" as const),
    endsLabel: formatBillingDate(product.deactivatesAt || nextBillingDate()),
    deleteLabel: formatBillingDate(addDays(anchor, DEACTIVATION_GRACE_DAYS), true),
    stillPaid: listingStillPaid(product),
    waiveFee,
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
