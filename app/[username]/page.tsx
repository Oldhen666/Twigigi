import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Stars } from "@/components/stars";
import { BackButton } from "@/components/back-button";
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
      <BackButton />
      <div className="mt-4">
        <Logo />
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
      {products.length === 0 ? <p className="mt-6 text-muted">Nothing is published yet.</p> : null}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/${seller.username}/${product.slug}`} className="block overflow-hidden rounded-3xl border border-line bg-card">
              <div className="relative aspect-[4/3] bg-paper-deep">
                {product.images[0] ? (
                  <Image src={product.images[0]} alt={product.title} fill className="object-cover" sizes="360px" />
                ) : null}
              </div>
              <div className="p-4">
                <h2 className="font-serif text-2xl">{product.title}</h2>
                <p className="mt-1 text-sm text-muted">{product.location}</p>
                <p className="mt-2 font-serif text-xl text-forest">
                  {product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request"}
                </p>
                <p className="mt-2 text-sm text-forest">{ctaCopy(product.cta).label}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
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
