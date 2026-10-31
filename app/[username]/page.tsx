import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Stars } from "@/components/stars";
import { BackButton } from "@/components/back-button";
import { SellerListings } from "@/components/seller-listings";
import { filterLiveTwigs, getPublicSeller, staticProductParams } from "@/lib/catalog";
import { ctaCopy, formatMoney } from "@/lib/format";

export function generateStaticParams() {
  const names = new Set(staticProductParams().map((item) => item.username));
  return [...names].map((username) => ({ username }));
}

async function SellerPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const seller = await getPublicSeller(username);
  if (!seller) notFound();
  const products = await filterLiveTwigs(seller.products);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6">
      <Logo />
      <div className="mt-3">
        <BackButton />
      </div>
      <p className="mt-10 text-sm text-muted">Twigger</p>
      <h1 className="mt-2 font-serif text-5xl">{seller.displayName}</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <span>{seller.username}</span>
        {seller.ratingCount > 0 && seller.ratingAverage != null ? (
          <span className="inline-flex items-center gap-1 text-forest">
            <Stars value={seller.ratingAverage} />
            <span className="font-medium text-ink">{seller.ratingAverage.toFixed(1)}</span>
          </span>
        ) : null}
      </p>
      {products.length === 0 ? (
        <p className="mt-6 text-muted">Nothing is published yet.</p>
      ) : (
        <SellerListings
          username={seller.username}
          listings={products.map((product) => ({
            slug: product.slug,
            title: product.title,
            location: product.location,
            priceLabel: product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request",
            ctaLabel: ctaCopy(product.cta).label,
            image: product.images[0] ?? "",
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

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const seller = await getPublicSeller(username);
  if (!seller) return { title: "Seller" };
  return {
    title: seller.displayName,
    description: `Twigs from ${seller.displayName}.`,
  };
}
