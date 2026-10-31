import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requestQuote } from "@/lib/actions";
import { getPublicProduct, requireLiveTwig, staticProductParams } from "@/lib/catalog";
import { sellerPath } from "@/lib/seller-route";
import { CheckoutForm } from "@/components/checkout-form";
import { ProductFallback, Stage } from "@/components/stage";
import { formatMoney } from "@/lib/format";

export function generateStaticParams() {
  return staticProductParams()
    .filter((item) => item.cta === "quote")
    .map(({ username, product }) => ({ username, product }));
}

export async function generateMetadata({ params }: { params: Promise<{ username: string; product: string }> }) {
  const { username, product } = await params;
  const publicId = sellerPath(username, `/${product}/quote`);
  const item = publicId ? await requireLiveTwig(await getPublicProduct(publicId, product)) : null;
  return { title: item ? `Quote for ${item.title}` : "Get a quote", robots: { index: false, follow: false } };
}

async function QuoteDetails({ params }: { params: Promise<{ username: string; product: string }> }) {
  const { username, product: slug } = await params;
  const publicId = sellerPath(username, `/${slug}/quote`);
  const product = publicId ? await requireLiveTwig(await getPublicProduct(publicId, slug)) : null;
  if (!product || product.cta !== "quote") notFound();
  return (
    <Stage>
      <div className="bg-card px-5 py-6 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(70,48,16,0.08)]">
        <Link href={`/${product.publicId}/${product.slug}`} className="text-sm text-muted">
          ← {product.title}
        </Link>
        <h1 className="mt-3 font-serif text-4xl">Get a quote</h1>
        <p className="mt-2 text-forest">
          {product.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Tell the seller what you need."}
        </p>
        {product.brand ? (
          <>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted">Service/product provider</p>
            <p className="mt-1 text-sm">{product.brand}</p>
          </>
        ) : null}
        <div className="mt-6">
          <CheckoutForm
            mode="quote"
            action={requestQuote}
            productId={product.id}
            currency={product.currency}
            priceCents={product.priceCents}
            options={[]}
            requireName={product.quoteForm?.askName ?? true}
            requirePhone={product.quoteForm?.askPhone ?? true}
            quoteForm={product.quoteForm}
          />
        </div>
      </div>
    </Stage>
  );
}

export default function Page({ params }: { params: Promise<{ username: string; product: string }> }) {
  return (
    <Suspense fallback={<ProductFallback />}>
      <QuoteDetails params={params} />
    </Suspense>
  );
}
